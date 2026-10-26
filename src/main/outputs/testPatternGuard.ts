import type {Logger} from '../log';
import {dispatchLogged, type LiveStore} from '../live/store';

interface NavigationDetails {
  readonly isMainFrame: boolean;
  readonly isSameDocument: boolean;
}

/** The part of the control window whose loss ends every 테스트 패턴. */
export interface PatternControl {
  readonly webContents: {
    isDestroyed(): boolean;
    on(event: 'render-process-gone', listener: () => void): unknown;
    on(
      event: 'did-start-navigation',
      listener: (details: NavigationDetails) => void,
    ): unknown;
    removeListener(event: 'render-process-gone', listener: () => void): unknown;
    removeListener(
      event: 'did-start-navigation',
      listener: (details: NavigationDetails) => void,
    ): unknown;
  };
  isDestroyed(): boolean;
  on(event: 'closed', listener: () => void): unknown;
  removeListener(event: 'closed', listener: () => void): unknown;
}

/**
 * Hides every 테스트 패턴 when the control window closes, crashes, or loads
 * its page again. 화면 설정 hides the pattern on every way out, but a control
 * window that goes away can't, and a pattern must never stay on a projector
 * during a service (docs/spec/06-settings.md).
 *
 * @returns A function that stops watching the control window.
 */
export function guardTestPatterns({
  control,
  store,
  log,
}: {
  readonly control: PatternControl;
  readonly store: LiveStore;
  readonly log: Logger;
}): () => void {
  const hideAll = (reason: string): void => {
    const shown = store.state.testPatterns ?? [];
    if (shown.length === 0) return;
    log.warn('hid the 테스트 패턴 because the control window went away', {
      reason,
      screens: shown.length,
    });
    for (const screenId of shown) {
      dispatchLogged(
        store,
        {type: 'screen.testPattern.set', screenId, on: false},
        log,
      );
    }
  };
  const onClosed = (): void => hideAll('closed');
  const onGone = (): void => hideAll('crashed');
  const onNavigation = ({isMainFrame, isSameDocument}: NavigationDetails) => {
    if (isMainFrame && !isSameDocument) hideAll('reloaded');
  };
  control.on('closed', onClosed);
  control.webContents.on('render-process-gone', onGone);
  control.webContents.on('did-start-navigation', onNavigation);
  return () => {
    control.removeListener('closed', onClosed);
    if (control.webContents.isDestroyed()) return;
    control.webContents.removeListener('render-process-gone', onGone);
    control.webContents.removeListener('did-start-navigation', onNavigation);
  };
}
