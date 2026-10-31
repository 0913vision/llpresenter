import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {settingsDocument} from '@core/testing/settingsDocument';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {MenuItemRow} from '@renderer/ui/MenuParts';
import {useTooltip} from '@renderer/ui/Tooltip';
import {useShortcutSettings} from './useShortcutSettings';
import {useWindowShortcuts} from './windowShortcuts';

afterEach(() => {
  cleanup();
  commandBindingStore.set({});
});

it('loads a remap through IPC and changes execution, open menu text, and tooltip keys together', async () => {
  let receive: (document: SettingsDocument) => void = () => undefined;
  let resolve: (document: SettingsDocument) => void = () => undefined;
  const initial = new Promise<SettingsDocument>(done => {
    resolve = done;
  });
  const stop = vi.fn();
  const run = vi.fn();
  const api = mockLlpApi({
    settings: {
      get: vi.fn(() => initial),
      subscribe: listener => {
        receive = listener;
        return stop;
      },
    },
  });
  function Host() {
    useShortcutSettings(api);
    useWindowShortcuts([{id: 'workspace.prep', run}]);
    const {targetProps, tooltip} = useTooltip({
      text: '준비',
      command: 'workspace.prep',
    });
    return (
      <>
        <button {...targetProps}>준비</button>
        {tooltip}
        <MenuItemRow
          item={{
            kind: 'item',
            id: 'prep',
            label: '준비',
            command: 'workspace.prep',
          }}
          id="prep"
          iconColumn={false}
          pointed={false}
          expanded={false}
          elementRef={() => undefined}
          onPoint={() => undefined}
          onLeave={() => undefined}
          onRun={run}
        />
      </>
    );
  }
  const view = render(<Host />);
  act(() =>
    receive(
      settingsDocument(
        'shortcuts',
        {bindings: {'workspace.prep': [{code: 'KeyK', mods: ['ctrl', 'alt']}]}},
        3,
      ),
    ),
  );
  expect(screen.getByRole('menuitem', {name: '준비'}).textContent).toContain(
    'Ctrl Alt K',
  );
  expect(
    screen
      .getByRole('button', {name: '준비'})
      .getAttribute('aria-keyshortcuts'),
  ).toBe('Control+Alt+K');
  fireEvent.keyDown(document.body, {
    code: 'KeyK',
    key: 'ㅏ',
    ctrlKey: true,
    altKey: true,
  });
  expect(run).toHaveBeenCalledOnce();
  act(() => resolve(settingsDocument('shortcuts', {bindings: {}}, 1)));
  await waitFor(() => expect(api.settings.get).toHaveBeenCalledOnce());
  expect(screen.getByRole('menuitem', {name: '준비'}).textContent).toContain(
    'Ctrl Alt K',
  );
  act(() =>
    receive(
      settingsDocument('shortcuts', {bindings: {'workspace.prep': []}}, 4),
    ),
  );
  fireEvent.keyDown(document.body, {code: 'KeyK', ctrlKey: true, altKey: true});
  expect(run).toHaveBeenCalledOnce();
  expect(screen.getByRole('menuitem', {name: '준비'}).textContent).toBe('준비');
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
  act(() => receive(settingsDocument('shortcuts', {bindings: {}}, 5)));
  expect(commandBindingStore.get()).toEqual({});
});
