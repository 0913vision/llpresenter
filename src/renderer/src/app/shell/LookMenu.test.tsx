import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useLive} from '@renderer/session/live';
import {parseLookId} from '@core/schema/ids';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {Toolbar} from './Toolbar';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';

function checkedLookId(value: string) {
  const parsed = parseLookId(value);
  if (!parsed.ok) throw new Error('Invalid test Look ID');
  return parsed.value;
}

function looksDocument(revision = 1, current = first) {
  const parsed = parseSettingsDocument({
    name: 'looks',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.looks',
      schemaVersion: 1,
      current,
      looks: [
        {id: first, name: '평상시', screens: {}},
        {id: second, name: '설교', screens: {}},
      ],
      lyricStyles: [],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'looks') {
    throw new Error('Invalid invented Look fixture');
  }
  return parsed.value;
}

function setup() {
  let push: (document: SettingsDocument) => void = () => undefined;
  const stop = vi.fn();
  const send = vi.fn();
  const onProblem = vi.fn();
  const onWorkspace = vi.fn();
  const api = fakeLlpApi({
    settings: {
      get: async () => looksDocument(),
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
    live: {send},
  });
  window.llp = api;
  const live = {...emptyLiveState(), lookId: checkedLookId(first)};
  useLive.setState({state: live});
  const view = render(
    <Toolbar
      sizeClass="normal"
      workspace="show"
      onWorkspace={onWorkspace}
      onProblem={onProblem}
    />,
  );
  return {
    api,
    send,
    onProblem,
    onWorkspace,
    live,
    view,
    stop,
    user: userEvent.setup(),
    push: (document: SettingsDocument) => push(document),
  };
}

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
  delete window.llp;
  resetTooltips();
});

it('checks the confirmed live Look and waits for live acknowledgement after choosing', async () => {
  const {api, user, send, live, push} = setup();
  const edit = vi.spyOn(api.settings, 'edit');
  const button = screen.getByRole('button', {name: 'Look'});
  button.focus();
  await user.keyboard('{ArrowDown}');
  const entries = await screen.findAllByRole('menuitemradio');
  expect(entries.map(entry => entry.textContent)).toEqual(['평상시', '설교']);
  expect(entries.map(entry => entry.getAttribute('aria-checked'))).toEqual([
    'true',
    'false',
  ]);
  await user.click(screen.getByRole('menuitemradio', {name: '설교'}));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'look.set',
    lookId: second,
  });
  expect(edit).not.toHaveBeenCalled();
  expect(useLive.getState().state).toBe(live);
  expect(screen.queryByRole('menu')).toBeNull();
  await user.click(button);
  await screen.findAllByRole('menuitemradio');
  act(() => push(looksDocument(2, second)));
  expect(
    screen
      .getAllByRole('menuitemradio')
      .map(entry => entry.getAttribute('aria-checked')),
  ).toEqual(['true', 'false']);
  act(() =>
    useLive.setState({state: {...live, lookId: checkedLookId(second)}}),
  );
  expect(
    screen
      .getAllByRole('menuitemradio')
      .map(entry => entry.getAttribute('aria-checked')),
  ).toEqual(['false', 'true']);
  expect(button.textContent).toContain('Look');
  await user.keyboard('{Escape}');
  expect(document.activeElement).toBe(button);
});

it('keeps a newer settings push over a slower read and releases the subscription', async () => {
  const {api, user, push, view, stop} = setup();
  let finish: (document: SettingsDocument) => void = () => undefined;
  vi.spyOn(api.settings, 'get').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await user.click(screen.getByRole('button', {name: 'Look'}));
  const current = looksDocument(2);
  act(() =>
    push({
      ...current,
      value: {
        ...current.value,
        looks: current.value.looks
          .filter(look => look.id === second)
          .map(look => ({...look, name: '새 Look'})),
      },
    }),
  );
  await screen.findByRole('menuitemradio', {name: '새 Look'});
  await act(async () => finish(looksDocument()));
  expect(screen.queryByRole('menuitemradio', {name: '평상시'})).toBeNull();
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it('reports a failed load through the host and retries when the menu is reopened', async () => {
  const {api, user, onProblem} = setup();
  const read = vi
    .spyOn(api.settings, 'get')
    .mockRejectedValueOnce(new Error('Invented read failure'));
  const button = screen.getByRole('button', {name: 'Look'});
  await user.click(button);
  await waitFor(() =>
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'toolbar-look:load',
        title: 'Look 불러오기 실패',
      }),
    ),
  );
  expect(button.getAttribute('aria-busy')).toBe('false');
  await user.keyboard('{Escape}');
  await user.click(button);
  await screen.findByRole('menuitemradio', {name: '평상시'});
  expect(read).toHaveBeenCalledTimes(2);
});

it('ignores a load failure after closing the menu', async () => {
  const {api, user, onProblem, stop} = setup();
  let fail: (cause: Error) => void = () => undefined;
  vi.spyOn(api.settings, 'get').mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  await user.click(screen.getByRole('button', {name: 'Look'}));
  await user.keyboard('{Escape}');
  await act(async () => fail(new Error('Invented late failure')));
  expect(onProblem).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
});

it('reports a command transport failure without claiming the new Look is live', async () => {
  const {user, send, onProblem, live} = setup();
  send.mockImplementation(() => {
    throw new Error('Invented transport failure');
  });
  await user.click(screen.getByRole('button', {name: 'Look'}));
  await user.click(await screen.findByRole('menuitemradio', {name: '설교'}));
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({
      key: 'toolbar-look:send',
      title: 'Look 변경 실패',
    }),
  );
  expect(useLive.getState().state).toBe(live);
});

it('stays disabled outside Electron without a stale confirmation warning', () => {
  delete window.llp;
  render(
    <Toolbar
      sizeClass="narrow"
      workspace="show"
      onWorkspace={() => undefined}
    />,
  );
  const button = screen.getByRole('button', {name: 'Look'});
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  fireEvent.keyDown(button, {key: 'ArrowDown'});
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('lists Look choices, a separator and Edit Looks in spec order', async () => {
  const {user, onWorkspace, send} = setup();
  await user.click(screen.getByRole('button', {name: 'Look'}));
  await screen.findAllByRole('menuitemradio');
  const menu = screen.getByRole('menu', {name: 'Look 선택'});
  expect(
    [...menu.querySelectorAll('[role^=menuitem], [role=separator]')].map(row =>
      row.getAttribute('role') === 'separator' ? '|' : row.textContent,
    ),
  ).toEqual(['평상시', '설교', '|', 'Look 편집…']);
  await user.click(screen.getByRole('menuitem', {name: 'Look 편집…'}));
  expect(onWorkspace).toHaveBeenCalledExactlyOnceWith('screens');
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'look',
    id: first,
  });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it('uses the configured default when live state has no explicit Look and leaves unknown state unchecked', async () => {
  const {user} = setup();
  act(() => useLive.setState({state: emptyLiveState()}));
  await user.click(screen.getByRole('button', {name: 'Look'}));
  const firstRow = await screen.findByRole('menuitemradio', {name: '평상시'});
  expect(firstRow.getAttribute('aria-checked')).toBe('true');
  act(() => useLive.setState({state: null}));
  expect(
    screen
      .getAllByRole('menuitemradio')
      .every(row => row.getAttribute('aria-checked') === 'false'),
  ).toBe(true);
});
