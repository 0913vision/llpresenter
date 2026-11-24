import {logFailure} from '@renderer/platform/logFailure';

/** Sends a panel that failed to draw to the app log. */
export function logPanelFailure(panel: string, error: unknown): void {
  logFailure(window.llp, `the ${panel} panel failed to draw`, error);
}
