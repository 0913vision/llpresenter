import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {emptyLiveState} from '@core/live/state';
import {themeFile} from '@core/testing/themeOutput';
import {settingsDocument} from '@core/testing/settingsDocument';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ThemeMenu} from './ThemeMenu';

function setup() {
  const file = themeFile();
  const first = file.themes[0];
  const second = file.themes[1];
  if (!first || !second) throw new Error('Missing theme fixture');
  const live = {
    ...emptyLiveState(),
    themeOutput: {themeId: first.id, revision: 1, missing: [], screens: {}},
  };
  useLive.setState({state: live});
  let push: (doc: SettingsDocument) => void = () => undefined;
  const stop = vi.fn();
  const send = vi.fn();
  const onEdit = vi.fn();
  const api = mockLlpApi({
    settings: {
      get: async () => settingsDocument('themes', file),
      subscribe: listener => {
        push = listener;
        return stop;
      },
    },
    live: {send},
  });
  window.llp = api;
  const view = render(<ThemeMenu compact={false} onEdit={onEdit} />);
  return {
    file,
    first,
    second,
    live,
    push: (doc: SettingsDocument) => push(doc),
    api,
    send,
    stop,
    onEdit,
    view,
    user: userEvent.setup(),
  };
}

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
  resetTooltips();
});

it('shows the confirmed live name even with the menu closed and follows renamed settings', async () => {
  const {file, first, push, view, stop} = setup();
  const button = await screen.findByRole('button', {
    name: `테마 바꾸기: ${first.name}`,
  });
  expect(button.textContent).toBe(first.name);
  expect((await hoverForTooltip(button))?.textContent).toBe('테마 바꾸기');
  act(() =>
    push(
      settingsDocument(
        'themes',
        {
          ...file,
          themes: file.themes.map(theme =>
            theme.id === first.id ? {...theme, name: 'Renamed theme'} : theme,
          ),
        },
        2,
      ),
    ),
  );
  expect(
    screen.getByRole('button', {name: '테마 바꾸기: Renamed theme'}),
  ).toBeTruthy();
  expect(button.textContent).toBe('Renamed theme');
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it('lists radio themes followed by a separator and editor, and waits for live acknowledgement', async () => {
  const {file, first, second, live, send, onEdit, user} = setup();
  const button = await screen.findByRole('button', {
    name: `테마 바꾸기: ${first.name}`,
  });
  button.focus();
  await user.keyboard('{ArrowDown}');
  const menu = screen.getByRole('menu', {name: '테마 바꾸기'});
  expect(
    Array.from(
      menu.querySelectorAll(
        '[role="menuitemradio"], [role="separator"], [role="menuitem"]',
      ),
    ).map(row => row.getAttribute('role')),
  ).toEqual([
    ...file.themes.map(() => 'menuitemradio'),
    'separator',
    'menuitem',
  ]);
  expect(
    within(menu)
      .getByRole('menuitemradio', {name: first.name})
      .getAttribute('aria-checked'),
  ).toBe('true');
  await user.click(
    within(menu).getByRole('menuitemradio', {name: second.name}),
  );
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'theme.set',
    themeId: second.id,
  });
  expect(useLive.getState().state).toBe(live);
  expect(button.textContent).toContain(first.name);
  act(() =>
    useLive.setState({
      state: {...live, themeOutput: {...live.themeOutput, themeId: second.id}},
    }),
  );
  expect(button.textContent).toContain(second.name);
  await user.click(button);
  await user.click(screen.getByRole('menuitem', {name: '테마 편집…'}));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(button);
});

it('keeps a newer pushed revision over a slow initial read and does not invent a selection before live state loads', async () => {
  const {api, file, first, push, user, view} = setup();
  view.unmount();
  let finish: (doc: SettingsDocument) => void = () => undefined;
  vi.spyOn(api.settings, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  useLive.setState({state: null});
  render(<ThemeMenu compact />);
  act(() =>
    push(
      settingsDocument(
        'themes',
        {...file, themes: [{...first, name: 'Newer theme'}]},
        3,
      ),
    ),
  );
  await act(async () => finish(settingsDocument('themes', file, 1)));
  await user.click(screen.getByRole('button', {name: '테마 바꾸기: 없음'}));
  const rows = screen.getAllByRole('menuitemradio');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.textContent).toBe('Newer theme');
  expect(rows[0]?.getAttribute('aria-checked')).toBe('false');
  fireEvent.keyDown(rows[0] ?? document.body, {key: 'Escape'});
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});
