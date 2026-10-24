import type {BrowserWindow} from 'electron';
import {Channels} from '@shared/ipc';
import {createElectronDisplaySource} from '../displays/electronSource';
import {DisplayRegistry} from '../displays/registry';
import {listenToWindows} from '../ipc';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import type {WindowMode} from '../windows/testWindows';
import {handleFrameRate} from '../rendererMessages';
import {createDefaultScreenSource} from './defaultScreens';
import {createElectronWakeLock} from './electronWakeLock';
import {createElectronOutputWindow} from './electronWindow';
import {FrameRateTracker} from './frameRates';
import {OutputManager} from './manager';
import {WakeKeeper, keepAwakeWhileOutputsOn} from './wakeLock';

/** What the output windows hang on. */
export interface OutputContext {
  readonly store: LiveStore;
  readonly control: BrowserWindow;
  readonly log: Logger;
  /** `offscreen` keeps the output windows off the screen (UI tests). */
  readonly windowMode: WindowMode;
}

/**
 * Starts watching the monitors and the output switches, opens the output
 * windows as outputs turn on, and follows their frame rate reports. Call it
 * after the app is ready.
 *
 * Keeps the display awake while any output is on.
 *
 * @returns A function that closes every output window, stops watching, and
 * lets the display sleep. Calling it again does nothing.
 */
export function startOutputs({
  store,
  control,
  log,
  windowMode,
}: OutputContext): () => void {
  const displays = new DisplayRegistry(createElectronDisplaySource(), log);
  const screens = createDefaultScreenSource(displays);
  const outputs = new OutputManager({
    store,
    displays,
    screens,
    controlBounds: () => (control.isDestroyed() ? null : control.getBounds()),
    createHandle: (screen, events) =>
      createElectronOutputWindow(screen, events, {log, mode: windowMode}),
    log,
  });
  outputs.start();
  const frameRates = new FrameRateTracker(
    screenId => screens.list().some(({id}) => id === screenId),
    log,
  );
  const stopFrameRates = listenToWindows(
    Channels.outputFrameRate,
    handleFrameRate(report => {
      frameRates.report(report);
      outputs.pageDrawn(report.screenId);
    }, log),
  );
  const stopKeepingAwake = keepAwakeWhileOutputsOn(
    store,
    new WakeKeeper(createElectronWakeLock(), log),
  );
  return () => {
    stopKeepingAwake();
    stopFrameRates();
    outputs.dispose();
    displays.dispose();
  };
}
