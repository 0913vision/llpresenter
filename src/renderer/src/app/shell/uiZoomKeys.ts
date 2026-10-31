import type {UiZoomCommand} from '@core/schema/uiZoom';
import {
  dispatchShortcut,
  type WindowShortcut,
} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

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

export function handleUiZoomKey(event: KeyboardEvent): void {
  dispatchShortcut(event, commands, 'capture');
}
export function useUiZoomKeys(): void {
  useWindowShortcuts(commands);
}
