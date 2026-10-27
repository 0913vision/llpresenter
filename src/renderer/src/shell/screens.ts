import type {Screen} from '@shared/schema/screens';
import {UNASSIGNED_TARGET, targetByMethod} from '@renderer/screens/screenRows';
import type {PreviewTarget} from '@renderer/ui/PreviewFrame';

export interface ScreenSummary {
  readonly id: string;
  readonly icon: string;
  readonly toolbarLabel: string;
  readonly statusLabel: string;
  readonly target: string;
  readonly targetKind: PreviewTarget['kind'];
  /** Draws the empty picture green (the 방송 자막). */
  readonly chroma: boolean;
}

/** Saved names and destinations in screen-document order, without role aliases. */
export function summarizeScreens(
  screens: readonly Screen[],
): readonly ScreenSummary[] {
  return screens.map(screen => ({
    id: screen.id,
    icon:
      screen.method === 'capture' || screen.method === 'ndi'
        ? 'capture'
        : 'mplay',
    toolbarLabel: screen.name,
    statusLabel: screen.name,
    target:
      screen.method === 'fullscreen'
        ? screen.display === undefined
          ? UNASSIGNED_TARGET
          : `모니터 ${screen.display.number} ${screen.display.name}`
        : targetByMethod[screen.method],
    targetKind: screen.method === 'fullscreen' ? 'display' : screen.method,
    chroma:
      (screen.previewBackground ?? 'green') === 'green' &&
      screen.kind !== 'stage' &&
      (screen.method === 'capture' || screen.method === 'ndi'),
  }));
}
