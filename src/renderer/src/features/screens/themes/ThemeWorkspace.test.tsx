import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {settingsDocument} from '@core/testing/settingsDocument';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {useLive} from '@renderer/session/live';
import {mockCanvasViewport} from '@renderer/ui/canvasTesting';
import {useThemePanels} from './useThemePanels';
import userEvent from '@testing-library/user-event';

const MAIN = createScreenId('00000000-0000-4000-8000-000000000001');
const STAGE = createScreenId('00000000-0000-4000-8000-000000000003');

beforeEach(mockCanvasViewport);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useLive.setState({state: null});
});

function setup() {
  const initial = settingsDocument('themes', createDefaultThemes());
  if (initial.name !== 'themes') throw new Error('Expected themes');
  let themes = initial;
  const song = themes.value.themes[0];
  if (song === undefined) throw new Error('Expected song theme');
  const screens = settingsDocument('screens', {
    screens: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: '본 화면',
        kind: 'audience',
        method: 'fullscreen',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: '방송 자막',
        kind: 'audience',
        method: 'capture',
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '무대 화면',
        kind: 'stage',
        method: 'fullscreen',
      },
    ],
  });
  const baseApi = mockLlpApi();
  const listeners = new Set<(document: SettingsDocument) => void>();
  let revision = 1;
  const edit = vi
    .fn<LlpApi['settings']['edit']>()
    .mockImplementation(change => {
      if (change.type !== 'settings.update' || change.name !== 'themes') {
        return baseApi.settings.edit(change);
      }
      themes = {...themes, value: change.value, revision: ++revision};
      for (const listener of listeners) listener(themes);
      return Promise.resolve({ok: true, value: {id: 'themes', revision}});
    });
  vi.stubGlobal('llp', undefined);
  const api = mockLlpApi({
    settings: {
      get: async request =>
        request.name === 'themes'
          ? themes
          : request.name === 'screens'
            ? screens
            : baseApi.settings.get(request),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  });
  window.llp = api;
  useLive.setState({
    state: {
      ...emptyLiveState(),
      themeOutput: {themeId: song.id, revision: 1, missing: [], screens: {}},
    },
  });
  const report = vi.fn();
  function Workspace() {
    const panels = useThemePanels(true, report);
    return (
      <>
        {panels.left}
        {panels.canvas}
        {panels.right}
      </>
    );
  }
  render(<Workspace />);
  return {edit, report, value: () => themes.value, listeners};
}

it('keeps standby first and LIVE before kind tags, and saves theme duplication and inline rename', async () => {
  const {value, listeners} = setup();
  const themes = await screen.findByRole('listbox', {name: '테마'});
  await waitFor(() =>
    expect(within(themes).getAllByRole('option')).toHaveLength(5),
  );
  expect(within(themes).getAllByRole('option')[0]?.textContent).toBe(
    '대기 화면',
  );
  const song = within(themes).getByRole('option', {name: '찬양'});
  expect(song.textContent).toBe('찬양LIVE곡');
  fireEvent.contextMenu(song, {clientX: 10, clientY: 10});
  fireEvent.click(await screen.findByRole('menuitem', {name: '복제'}));
  const copied = await screen.findByRole('option', {name: '찬양 복사본'});
  fireEvent.contextMenu(copied, {clientX: 10, clientY: 10});
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  const input = await within(copied).findByRole('textbox');
  fireEvent.change(input, {target: {value: '점검 테마'}});
  fireEvent.keyDown(input, {key: 'Enter'});
  await waitFor(() =>
    expect(value().themes.some(theme => theme.name === '점검 테마')).toBe(true),
  );
  cleanup();
  expect(listeners.size).toBe(0);
});

it('adds and deletes elements with keyboard actions and saves checkbox/text properties', async () => {
  const {value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  const clock = screen.getByRole('button', {name: '시계'});
  fireEvent.click(clock);
  await waitFor(() =>
    expect(
      value().themes[0]?.screens[MAIN]?.elements.some(
        element => element.kind === 'clock',
      ),
    ).toBe(true),
  );
  const pictureClock = screen.getByRole('button', {name: '시계'});
  await waitFor(() =>
    expect(pictureClock.getAttribute('aria-pressed')).toBe('true'),
  );
  fireEvent.keyDown(pictureClock, {key: 'Delete'});
  await waitFor(() =>
    expect(
      value().themes[0]?.screens[MAIN]?.elements.some(
        element => element.kind === 'clock',
      ),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', {name: '현재 가사'}));
  const outline = await screen.findByRole('checkbox', {name: '외곽선'});
  const before = outline.getAttribute('aria-checked') === 'true';
  fireEvent.click(outline);
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.text.outline.on).toBe(!before);
  });
  expect(
    screen
      .getByRole('spinbutton', {name: '크기'})
      .getAttribute('aria-valuemax'),
  ).toBe('400');
  expect(
    screen
      .getByRole('spinbutton', {name: '최대 줄 수'})
      .getAttribute('aria-valuemax'),
  ).toBe('12');
});

it.each(['single', 'all'] as const)(
  'keeps the remaining %s selection when the row trash removes another element',
  async selection => {
    const {value} = setup();
    await screen.findByRole('button', {name: '현재 가사'});
    const tile = screen.getByRole('button', {name: '시계'});
    tile.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        value().themes[0]?.screens[MAIN]?.elements.some(
          element => element.kind === 'clock',
        ),
      ).toBe(true),
    );
    const clock = screen.getByRole('button', {name: '시계'});
    await waitFor(() => expect(document.activeElement).toBe(clock));
    const current = screen.getByRole('button', {name: '현재 가사'});
    fireEvent.click(current);
    if (selection === 'all') {
      fireEvent.keyDown(current, {key: 'a', code: 'KeyA', ctrlKey: true});
    }
    fireEvent.click(screen.getByRole('button', {name: '시계 삭제'}));
    await waitFor(() =>
      expect(
        value().themes[0]?.screens[MAIN]?.elements.some(
          element => element.kind === 'clock',
        ),
      ).toBe(false),
    );
    const list = screen.getByRole('listbox', {name: '요소'});
    expect(
      within(list)
        .getAllByRole('option')
        .filter(row => row.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(selection === 'all' ? 3 : 1);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        selection === 'all' ? screen.getByLabelText('테마 캔버스') : current,
      ),
    );
  },
);

it('shares the aspect-ratio toggle with numeric frame properties and commits multiline fixed text', async () => {
  const {value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.click(
    within(screen.getByRole('region', {name: '요소 추가'})).getByRole(
      'button',
      {name: '글'},
    ),
  );
  const content = await screen.findByRole('textbox', {name: '내용'});
  content.focus();
  fireEvent.change(content, {target: {value: 'First line\nSecond line'}});
  fireEvent.keyDown(content, {key: 'Enter', ctrlKey: true});
  fireEvent.click(screen.getByRole('button', {name: '비율 고정'}));
  const width = screen.getByRole('spinbutton', {name: 'W'});
  fireEvent.change(width, {target: {value: '400'}});
  fireEvent.keyDown(width, {key: 'Enter'});
  await waitFor(() => {
    const element = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'text',
    );
    expect(element?.content).toBe('First line\nSecond line');
    expect(element?.frame).toMatchObject({w: 400, h: 120});
  });
});

it('keeps the new screen selection when an older element creation completes', async () => {
  const {edit, value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  const implementation = edit.getMockImplementation();
  if (implementation === undefined) {
    throw new Error('Missing settings implementation');
  }
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  edit.mockImplementationOnce(async change => {
    const result = await implementation(change);
    await pending;
    return result;
  });
  fireEvent.click(screen.getByRole('button', {name: '시계'}));
  await waitFor(() =>
    expect(
      value().themes[0]?.screens[MAIN]?.elements.some(
        element => element.kind === 'clock',
      ),
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  await act(async () => {
    release();
    await pending;
  });
  await waitFor(() =>
    expect(
      screen.getByRole('tab', {name: '화면'}).getAttribute('aria-selected'),
    ).toBe('true'),
  );
});

it('selects every element and pastes the clipboard into another screen with retained position and appearance', async () => {
  const {value} = setup();
  const canvas = await screen.findByLabelText('테마 캔버스');
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.keyDown(canvas, {key: 'a', code: 'KeyA', ctrlKey: true});
  const elements = screen.getByRole('listbox', {name: '요소'});
  expect(
    within(elements)
      .getAllByRole('option')
      .every(row => row.getAttribute('aria-selected') === 'true'),
  ).toBe(true);
  let text = '';
  fireEvent.copy(canvas, {
    clipboardData: {
      setData: (_format: string, value: string) => {
        text = value;
      },
    },
  });
  const source = value().themes[0]?.screens[MAIN]?.elements.find(
    element => element.kind === 'currentText',
  );
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  await act(async () => {
    fireEvent.paste(screen.getByLabelText('테마 캔버스'), {
      clipboardData: {getData: () => text},
    });
  });
  await waitFor(() => {
    const pasted = value().themes[0]?.screens[STAGE]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(pasted?.frame).toEqual(source?.frame);
    expect(pasted?.text).toEqual(source?.text);
  });
});
