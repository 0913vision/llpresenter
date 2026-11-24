import type {UiZoomCommand} from '@core/schema/app/uiZoom';
import type {WindowShortcut} from '@renderer/ui/keys/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';

const commands: readonly WindowShortcut[] = (
  ['ui.zoomIn', 'ui.zoomOut', 'ui.zoomReset'] as const
).map(type => ({
  id: type,
  run: () => {
    const api = window.llp;
    if (api === undefined) return;
    const command: UiZoomCommand = {type};
    api.ui.changeZoom(command).catch((error: unknown) =>
      api.log.write({
        level: 'error',
        message: 'could not change UI zoom',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  },
}));

/** Lets the zoom commands zoom this window, whatever keys they are bound to. */
export function useUiZoomKeys(): void {
  useWindowShortcuts(commands);
}
