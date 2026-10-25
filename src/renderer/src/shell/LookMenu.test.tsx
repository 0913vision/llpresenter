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
import {emptyLiveState} from '@shared/live';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {Toolbar} from './Toolbar';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';

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
  const live = emptyLiveState();
  useLive.setState({state: live});
  const view = render(
    <Toolbar
      sizeClass="normal"
      workspace="show"
      onWorkspace={() => undefined}
      onProblem={onProblem}
    />,
  );
  return {
    api,
    send,
    onProblem,
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
  delete window.llp;
  resetTooltips();
});

it('sends the Look command without turning persisted settings into a confirmed live check', async () => {
  const {api, user, send, live, push} = setup();
  const edit = vi.spyOn(api.settings, 'edit');
  const button = screen.getByRole('button', {name: 'Look'});
  button.focus();
  await user.keyboard('{ArrowDown}');
  const entries = await screen.findAllByRole('menuitemradio');
  expect(entries.map(entry => entry.textContent)).toEqual(['평상시', '설교']);
  expect(
    entries.every(entry => entry.getAttribute('aria-checked') === 'false'),
  ).toBe(true);
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
      .every(entry => entry.getAttribute('aria-checked') === 'false'),
  ).toBe(true);
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

it('explains the missing confirmation in a tooltip and stays disabled outside Electron', async () => {
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
  expect((await hoverForTooltip(button))?.textContent).toBe(
    '현재 버전에서는 Look 적용을 확인할 수 없음',
  );
});
