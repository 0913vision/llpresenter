import type {ScreenSummary} from '@renderer/platform/screens';
import {MAX_LIVE_BATCH_COMMANDS} from '@core/schema/liveCommand';
import {sendLive} from '@renderer/session/live';
import {stopItem} from '@renderer/session/clear';
import {menuAvailability, type MenuItem} from '@renderer/ui/menuModel';

/** Toggles the whole group from its any-on state in capped live batches. */
export function outputGroup(
  screens: readonly ScreenSummary[],
  outputs: Readonly<Record<string, boolean>>,
): MenuItem {
  const on = screens.some(screen => outputs[screen.id] === true);
  return {
    kind: 'item',
    id: 'output',
    label: on ? '출력 끄기' : '출력 켜기',
    ...menuAvailability(screens.length === 0 ? '화면 없음' : undefined),
    onSelect: () => {
      const commands = screens.map(screen => ({
        type: 'output.set' as const,
        screenId: screen.id,
        on: !on,
      }));
      for (let at = 0; at < commands.length; at += MAX_LIVE_BATCH_COMMANDS) {
        sendLive({
          type: 'live.batch',
          commands: commands.slice(at, at + MAX_LIVE_BATCH_COMMANDS),
        });
      }
    },
  };
}

/** Preserves the item-stop command and its unavailable reason. */
export function itemStopEntry(hasItem: boolean): MenuItem {
  return {
    kind: 'item',
    id: 'item-stop',
    command: 'item.stop',
    label: '항목 끄기',
    ...menuAvailability(hasItem ? undefined : '출력 중인 항목 없음'),
    onSelect: stopItem,
  };
}
