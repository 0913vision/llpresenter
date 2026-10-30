import {sendLive} from '@renderer/platform/live';
import {outputTooltip} from '@renderer/ui/OutputToggle';
import type {MenuEntry} from '@renderer/ui/menuModel';
import type {ScreenSummary} from '../../platform/screens';

/** The same saved-screen toggles in the output menu and toolbar overflow. */
export function screenOutputEntries(
  screens: readonly ScreenSummary[],
  outputs: Readonly<Record<string, boolean>>,
): readonly MenuEntry[] {
  return screens.map(screen => {
    const on = outputs[screen.id] === true;
    return {
      kind: 'item',
      id: `output:${screen.id}`,
      label: screen.statusLabel,
      check: 'checkbox',
      checked: on,
      title: outputTooltip({
        screenName: screen.statusLabel,
        target: screen.target,
        state: on ? 'live' : 'off',
      }),
      onSelect: () =>
        sendLive({type: 'output.set', screenId: screen.id, on: !on}),
    };
  });
}
