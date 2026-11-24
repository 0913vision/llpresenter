import {logFailure} from '@renderer/platform/logFailure';
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
    api.ui
      .changeZoom(command)
      .catch((error: unknown) =>
        logFailure(api, 'could not change UI zoom', error),
      );
  },
}));

/** Lets the zoom commands zoom this window, whatever keys they are bound to. */
export function useUiZoomKeys(): void {
  useWindowShortcuts(commands);
}
