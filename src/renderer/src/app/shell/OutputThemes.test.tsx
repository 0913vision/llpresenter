import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createThemeId} from '@core/schema/ids';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {
  looksDocument,
  stageLayoutsDocument,
} from '@core/testing/screenDocuments';
import {settingsDocument} from '@core/testing/settingsDocument';
import {themeFile} from '@core/testing/themeOutput';
import {useLive} from '@renderer/session/live';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {MenuBar} from './MenuBar';
import {renderWithScreenSummaries as render} from '../../platform/testing/screenSummaries';

const first = createThemeId('00000000-0000-4000-8000-000000000001');
const second = createThemeId('00000000-0000-4000-8000-000000000002');
function themesDocument(revision = 1) {
  return settingsDocument(
    'themes',
    {
      ...themeFile(),
      themes: [
        {id: first, name: '평상시', screens: {}},
        {id: second, name: '설교', screens: {}},
      ],
    },
    revision,
  );
}
function liveTheme(id = first) {
  useLive.setState({
    state: {
      ...emptyLiveState(),
      themeOutput: {themeId: id, revision: 1, missing: [], screens: {}},
    },
  });
}
function setup() {
  const send = vi.fn();
  const onProblem = vi.fn();
  const listeners = new Set<(doc: SettingsDocument) => void>();
  const api = mockLlpApi({
    live: {send},
    settings: {
      get: async request =>
        request.name === 'themes'
          ? themesDocument()
          : request.name === 'looks'
            ? looksDocument()
            : stageLayoutsDocument(),
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  window.llp = api;
  const view = render(
    <MenuBar title="" onProblem={onProblem} onWorkspace={vi.fn()} />,
  );
  return {
    api,
    send,
    onProblem,
    view,
    listeners,
    push: (doc: SettingsDocument) => {
      for (const listener of listeners) listener(doc);
    },
  };
}
async function openOutput() {
  await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
}
async function openThemes() {
  await userEvent.click(
    await screen.findByRole('menuitem', {name: /^테마 바꾸기:/}),
  );
  await screen.findByRole('menu', {name: /^테마 바꾸기:/});
}
async function openMenu() {
  await openOutput();
  await openThemes();
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  liveTheme();
});
afterEach(() => {
  commandBindingStore.set({});
  useLive.setState({state: null});
  delete window.llp;
});

it('loads themes when Output opens and lists confirmed radios and the editor', async () => {
  const {api} = setup();
  const get = vi.spyOn(api.settings, 'get');
  expect(get).not.toHaveBeenCalled();
  await openMenu();
  expect(get).toHaveBeenCalledWith({name: 'themes'});
  expect(
    screen
      .getByRole('menuitemradio', {name: '평상시'})
      .getAttribute('aria-checked'),
  ).toBe('true');
  expect(
    screen
      .getByRole('menuitemradio', {name: '설교'})
      .getAttribute('aria-checked'),
  ).toBe('false');
  expect(screen.getByRole('menuitem', {name: '테마 편집…'})).toBeTruthy();
});

it('executes an assigned theme command with the Output menu closed', async () => {
  commandBindingStore.set({[`theme.${second}`]: [{code: 'F8', mods: []}]});
  const {send} = setup();
  await act(async () => undefined);
  fireEvent.keyDown(document.body, {code: 'F8', key: 'F8'});
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'theme.set',
    themeId: second,
  });
  expect(screen.queryByRole('menu')).toBeNull();
});

it('waits for main acknowledgement and follows later theme changes', async () => {
  const {send} = setup();
  const before = useLive.getState().state;
  await openMenu();
  await userEvent.click(screen.getByRole('menuitemradio', {name: '설교'}));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'theme.set',
    themeId: second,
  });
  expect(useLive.getState().state).toBe(before);
  await openMenu();
  expect(
    screen
      .getByRole('menuitemradio', {name: '평상시'})
      .getAttribute('aria-checked'),
  ).toBe('true');
  act(() => liveTheme(second));
  expect(
    screen
      .getByRole('menuitemradio', {name: '설교'})
      .getAttribute('aria-checked'),
  ).toBe('true');
});

it('does not invent a live choice before the snapshot or after its target is deleted', async () => {
  const {push} = setup();
  useLive.setState({state: null});
  await openMenu();
  expect(
    screen
      .getAllByRole('menuitemradio')
      .every(row => row.getAttribute('aria-checked') === 'false'),
  ).toBe(true);
  act(() => liveTheme(second));
  const doc = themesDocument(2);
  if (doc.name !== 'themes') throw new Error('Invalid theme fixture');
  act(() =>
    push({
      ...doc,
      value: {
        ...doc.value,
        themes: doc.value.themes.filter(theme => theme.id === first),
      },
    }),
  );
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  expect(screen.getByRole('menuitemradio').getAttribute('aria-checked')).toBe(
    'false',
  );
});

it('keeps a newer push over a slow read and releases subscriptions on close', async () => {
  const {api, push, listeners} = setup();
  let finish: (doc: SettingsDocument) => void = () => undefined;
  const get = api.settings.get;
  vi.spyOn(api.settings, 'get').mockImplementation(request =>
    request.name === 'themes'
      ? new Promise(resolve => {
          finish = resolve;
        })
      : get(request),
  );
  await openMenu();
  const doc = themesDocument(3);
  if (doc.name !== 'themes') throw new Error('Invalid theme fixture');
  act(() =>
    push({
      ...doc,
      value: {
        ...doc.value,
        themes: [{id: second, name: 'New name', screens: {}}],
      },
    }),
  );
  await act(async () => finish(themesDocument(1)));
  expect(screen.getByRole('menuitemradio', {name: 'New name'})).toBeTruthy();
  expect(screen.queryByRole('menuitemradio', {name: '평상시'})).toBeNull();
  await userEvent.keyboard('{Escape}{Escape}');
  await waitFor(() => expect(listeners.size).toBe(0));
});

it('reports a failed theme load and retries after closing Output', async () => {
  const {api, onProblem} = setup();
  const get = api.settings.get;
  let failed = false;
  vi.spyOn(api.settings, 'get').mockImplementation(request => {
    if (request.name === 'themes' && !failed) {
      failed = true;
      return Promise.reject(new Error('Invented read failure'));
    }
    return get(request);
  });
  await openOutput();
  await waitFor(() =>
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({title: '테마 불러오기 실패'}),
    ),
  );
  expect(screen.getByRole('group', {name: '본 화면'})).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  await openMenu();
  await screen.findByRole('menuitemradio', {name: '평상시'});
});

it('reports a transport failure without changing the confirmed live theme', async () => {
  const {send, onProblem} = setup();
  send.mockImplementation(() => {
    throw new Error('Invented transport failure');
  });
  const before = useLive.getState().state;
  await openMenu();
  await userEvent.click(screen.getByRole('menuitemradio', {name: '설교'}));
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({title: '테마 변경 실패'}),
  );
  expect(useLive.getState().state).toBe(before);
});
