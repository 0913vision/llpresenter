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
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@core/schema/contentDocuments';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {Theme} from '@core/schema/themes';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useLive} from '@renderer/session/live';
import {mockCanvasViewport} from '@fixtures/renderer/ui/canvasTesting';
import {ThemeLeaveGuard} from '@renderer/features/screens/themes/themeLeaveGuard';
import {useThemePanels} from '@renderer/features/screens/themes/useThemePanels';
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

function setup({
  idle = false,
  services,
}: {
  readonly idle?: boolean;
  readonly services?: Partial<LlpApi['services']>;
} = {}) {
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
    ...(services === undefined ? {} : {services}),
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
    state: idle
      ? emptyLiveState()
      : {
          ...emptyLiveState(),
          themeOutput: {
            themeId: song.id,
            revision: 1,
            missing: [],
            screens: {},
          },
        },
  });
  const report = vi.fn();
  const guard = new ThemeLeaveGuard();
  function Workspace() {
    const panels = useThemePanels(true, report, guard);
    return (
      <>
        {panels.left}
        {panels.canvas}
        {panels.right}
      </>
    );
  }
  render(<Workspace />);
  return {edit, report, guard, value: () => themes.value, listeners};
}

async function saveEdits() {
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  fireEvent.click(await screen.findByRole('button', {name: '덮어쓰기'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
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

it('shows clean geometry after selection and preserves explicitly typed precision', async () => {
  const {value} = setup();
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  for (const [name, shown] of [
    ['X', '115.2'],
    ['Y', '64.8'],
    ['W', '1689.6'],
    ['H', '950.4'],
  ] as const) {
    expect(screen.getByRole('spinbutton', {name})).toHaveProperty(
      'value',
      shown,
    );
  }
  const x = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(x, {target: {value: '115.253'}});
  fireEvent.keyDown(x, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.frame.x).toBe(115.253);
    expect(x).toHaveProperty('value', '115.3');
  });
});

it('adds and deletes elements with keyboard actions and saves checkbox/text properties', async () => {
  const {value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  const clock = screen.getByRole('button', {name: '시계'});
  fireEvent.click(clock);
  await saveEdits();
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
  await saveEdits();
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
  await saveEdits();
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
  const size = screen.getByRole('spinbutton', {name: '크기'});
  fireEvent.change(size, {target: {value: '72'}});
  fireEvent.keyDown(size, {key: 'Enter'});
  fireEvent.click(screen.getByRole('checkbox', {name: '채우기'}));
  await saveEdits();
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.text.size).toBe(72);
    expect(current?.box?.on).toBe(true);
  });
});

it('renders the edited background through a screen link and restores retained elements after empty mode', async () => {
  const {value} = setup();
  await screen.findByLabelText('테마 캔버스');
  const canvas = () => screen.getByLabelText('테마 캔버스');
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  const background = screen.getByRole('textbox', {name: '배경색'});
  background.focus();
  fireEvent.change(background, {target: {value: '#1C355C'}});
  fireEvent.keyDown(background, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[MAIN]?.background).toBe('#1C355C');
    expect(canvas().querySelector('svg')?.style.backgroundColor).toBe(
      'rgb(28, 53, 92)',
    );
  });
  const mainElements = value().themes[0]?.screens[MAIN]?.elements;
  const stageElements = value().themes[0]?.screens[STAGE]?.elements;
  expect(mainElements?.length).toBeGreaterThan(0);
  expect(stageElements?.length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  fireEvent.click(screen.getByRole('radio', {name: '본 화면과 동일'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({
      kind: 'same',
      screen: MAIN,
    });
    expect(canvas().querySelector('svg')?.style.backgroundColor).toBe(
      'rgb(28, 53, 92)',
    );
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(
      mainElements?.length ?? 0,
    );
  });
  fireEvent.click(screen.getByRole('radio', {name: '비움'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({kind: 'empty'});
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(0);
  });
  fireEvent.click(screen.getByRole('radio', {name: '직접 배치'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({kind: 'own'});
    expect(value().themes[0]?.screens[STAGE]?.elements).toEqual(stageElements);
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(
      stageElements?.length ?? 0,
    );
  });
});

it.each(['single', 'all'] as const)(
  'keeps the remaining %s selection when the row trash removes another element',
  async selection => {
    const {value} = setup();
    await screen.findByRole('button', {name: '현재 가사'});
    const tile = screen.getByRole('button', {name: '시계'});
    tile.focus();
    await userEvent.keyboard('{Enter}');
    await saveEdits();
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
    await saveEdits();
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
  await saveEdits();
  await waitFor(() => {
    const element = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'text',
    );
    expect(element?.content).toBe('First line\nSecond line');
    expect(element?.frame).toMatchObject({w: 400, h: 120});
  });
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
  await saveEdits();
  await waitFor(() => {
    const pasted = value().themes[0]?.screens[STAGE]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(pasted?.frame).toEqual(source?.frame);
    expect(pasted?.text).toEqual(source?.text);
  });
});

it('marks standby as live while the output is idle', async () => {
  setup({idle: true});
  const themes = await screen.findByRole('listbox', {name: '테마'});

  await waitFor(() =>
    expect(
      within(themes).getByRole('option', {name: '대기 화면'}).textContent,
    ).toContain('LIVE'),
  );
  expect(
    within(themes).getByRole('option', {name: '찬양'}).textContent,
  ).not.toContain('LIVE');
});

const EDITED_X = 120;
const SERVICE_ID = '00000000-0000-4000-8000-000000000010';
const itemId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function servicesWithSongItems(count: number): Partial<LlpApi['services']> {
  const entries = parseServiceEntries([
    {
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    },
  ]);
  const document = parseServiceDocument({
    revision: 1,
    access: 'editable',
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      order: Array.from({length: count}, (_, index) => ({
        id: itemId(index + 100),
        song: itemId(index + 200),
      })),
    },
  });
  if (!entries.ok || !document.ok || !document.value) {
    throw new Error('Invalid invented service');
  }
  const {value} = document;
  return {list: async () => entries.value, get: async () => value};
}

async function editCurrentTextX(x = EDITED_X) {
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  const field = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(field, {target: {value: String(x)}});
  fireEvent.keyDown(field, {key: 'Enter'});
}

const currentTextX = (theme: Theme | undefined) =>
  theme?.screens[MAIN]?.elements.find(element => element.kind === 'currentText')
    ?.frame.x;

const modifiedMark = () =>
  within(screen.getByRole('listbox', {name: '테마'})).queryByRole('img', {
    name: '저장하지 않은 변경',
  });

it('keeps edits in the working copy until 저장 asks before overwriting', async () => {
  const {edit, value} = setup();
  const original = currentTextX(value().themes[0]);
  const saveButton = await screen.findByRole('button', {name: '저장'});
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
  await editCurrentTextX();
  expect(modifiedMark()).not.toBeNull();
  expect(saveButton.getAttribute('aria-disabled')).not.toBe('true');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(saveButton);
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('‘찬양’ 테마를 덮어쓸까요?');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(edit).not.toHaveBeenCalled();
  expect(currentTextX(value().themes[0])).toBe(original);
  await saveEdits();
  expect(currentTextX(value().themes[0])).toBe(EDITED_X);
  expect(modifiedMark()).toBeNull();
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
});

it('counts the items that use the theme in the overwrite question and hides a zero', async () => {
  const used = setup({services: servicesWithSongItems(2)});
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  const dialog = await screen.findByRole('alertdialog');
  await waitFor(() =>
    expect(dialog.textContent).toContain('예배 순서 항목 2곳에서 씀'),
  );
  expect(used.edit).not.toHaveBeenCalled();
  cleanup();
  setup({services: servicesWithSongItems(0)});
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  const empty = await screen.findByRole('alertdialog');
  await waitFor(() =>
    expect(empty.textContent).not.toContain('사용 항목을 확인하는 중'),
  );
  expect(empty.textContent).not.toContain('곳에서 씀');
});

it('saves the working copy under a new name and leaves the original as it was', async () => {
  const {value} = setup();
  const original = currentTextX(value().themes[0]);
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '다른 이름으로 저장…'}));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('textbox')).toHaveProperty(
    'value',
    '찬양 복사본',
  );
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() => expect(value().themes).toHaveLength(5));
  const copy = value().themes.at(-1);
  expect(copy?.name).toBe('찬양 복사본');
  expect(currentTextX(copy)).toBe(EDITED_X);
  expect(currentTextX(value().themes[0])).toBe(original);
  expect(
    (await screen.findByRole('option', {name: '찬양 복사본'})).getAttribute(
      'aria-selected',
    ),
  ).toBe('true');
  expect(modifiedMark()).toBeNull();
});

it('asks 저장, 저장 안 함, or 취소 before another theme replaces the edits', async () => {
  const {edit, value} = setup();
  const original = currentTextX(value().themes[0]);
  await editCurrentTextX();
  const other = await screen.findByRole('option', {name: '말씀'});
  fireEvent.click(other);
  let dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('‘찬양’ 테마의 변경을 저장할까요?');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(
    screen.getByRole('option', {name: '찬양'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(modifiedMark()).not.toBeNull();
  fireEvent.click(other);
  dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장 안 함'}));
  await waitFor(() => expect(other.getAttribute('aria-selected')).toBe('true'));
  expect(edit).not.toHaveBeenCalled();
  expect(modifiedMark()).toBeNull();
  fireEvent.click(screen.getByRole('option', {name: '찬양'}));
  await waitFor(() => expect(currentTextX(value().themes[0])).toBe(original));
  await editCurrentTextX();
  fireEvent.click(other);
  dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() => expect(currentTextX(value().themes[0])).toBe(EDITED_X));
  await waitFor(() => expect(other.getAttribute('aria-selected')).toBe('true'));
});

it('asks 저장, 저장 안 함, or 취소 when the window closes with unsaved edits', async () => {
  const {edit, value} = setup();
  const api = window.llp;
  if (api === undefined) throw new Error('Expected the window API');
  const writes = pendingWritesOf(api);
  await expect(writes.settleDrafts()).resolves.toBe('settled');
  await editCurrentTextX();
  const answer = async (name: string) => {
    const settling = writes.settleDrafts();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', {name}));
    return settling;
  };
  await expect(answer('취소')).resolves.toBe('canceled');
  expect(modifiedMark()).not.toBeNull();
  expect(edit).not.toHaveBeenCalled();
  await expect(answer('저장')).resolves.toBe('settled');
  expect(currentTextX(value().themes[0])).toBe(EDITED_X);
  await editCurrentTextX(EDITED_X + 10);
  await expect(answer('저장 안 함')).resolves.toBe('settled');
  expect(modifiedMark()).toBeNull();
});

it('saves a copy from a theme with no edits', async () => {
  const {value} = setup();
  const original = currentTextX(value().themes[0]);
  fireEvent.click(
    await screen.findByRole('button', {name: '다른 이름으로 저장…'}),
  );
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() => expect(value().themes).toHaveLength(5));
  expect(currentTextX(value().themes.at(-1))).toBe(original);
  expect(value().themes.at(-1)?.name).toBe('찬양 복사본');
});

it('lets the shell leave at once with no edits and asks first with unsaved edits', async () => {
  const {edit, guard} = setup();
  const proceed = vi.fn();
  await screen.findByRole('button', {name: '현재 가사'});
  act(() => guard.leave(proceed));
  expect(proceed).toHaveBeenCalledTimes(1);
  await editCurrentTextX();
  act(() => guard.leave(proceed));
  expect(proceed).toHaveBeenCalledTimes(1);
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(proceed).toHaveBeenCalledTimes(1);
  act(() => guard.leave(proceed));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: '저장 안 함',
    }),
  );
  expect(proceed).toHaveBeenCalledTimes(2);
  expect(edit).not.toHaveBeenCalled();
  expect(modifiedMark()).toBeNull();
});
