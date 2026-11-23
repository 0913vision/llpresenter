import {NDI_DEFAULT_FPS, type Screen} from '@core/schema/screens';
import type {MonitorList} from '@core/schema/monitors';
import {
  monitorAssignment,
  UNASSIGNED_TARGET,
  targetByMethod,
} from '@core/screens';
import type {PreviewTarget} from '@renderer/ui/PreviewFrame';

export interface ScreenSummary {
  readonly id: string;
  readonly icon: string;
  readonly toolbarLabel: string;
  readonly statusLabel: string;
  readonly ndiFps?: number;
  readonly target: string;
  readonly targetKind: PreviewTarget['kind'];
  /** Draws the empty picture green (the 방송 화면). */
  readonly chroma: boolean;
  /** 청중 or 무대; summaries made without it count as 청중. */
  readonly kind?: Screen['kind'] | undefined;
}

/** The toolbar and status bar names of screens, in the order they are given. */
export function summarizeScreens(
  screens: readonly Screen[],
  monitors: MonitorList = [],
): readonly ScreenSummary[] {
  const assignment = monitorAssignment(monitors);
  return screens.map(screen => {
    const display = assignment.get(screen.id) ?? screen.display;
    return {
      id: screen.id,
      icon:
        screen.method === 'capture' || screen.method === 'ndi'
          ? 'capture'
          : 'mplay',
      toolbarLabel: screen.name,
      statusLabel: screen.name,
      ndiFps: screen.ndi?.fps ?? NDI_DEFAULT_FPS,
      target:
        screen.method === 'fullscreen'
          ? display === undefined
            ? UNASSIGNED_TARGET
            : `모니터 ${display.number} ${display.name}`
          : targetByMethod[screen.method],
      targetKind: screen.method === 'fullscreen' ? 'display' : screen.method,
      kind: screen.kind,
      chroma:
        (screen.previewBackground ?? 'green') === 'green' &&
        screen.kind !== 'stage' &&
        (screen.method === 'capture' || screen.method === 'ndi'),
    };
  });
}
