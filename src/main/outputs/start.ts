import type {BrowserWindow} from 'electron';
import {Channels} from '@shared/ipc';
import {createElectronDisplaySource} from '../displays/electronSource';
import {DisplayRegistry} from '../displays/registry';
import {answerWindows, listenToWindows, sendToWindows} from '../ipc';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import type {WindowMode} from '../windows/testWindows';
import {handleFrameRate, handleRetryRequest} from '../rendererMessages';
import {createDefaultScreenSource} from './defaultScreens';
import {createElectronWakeLock} from './electronWakeLock';
import {createElectronOutputWindow} from './electronWindow';
import {FrameRateTracker, type ScreenFrameRate} from './frameRates';
import {OutputManager} from './manager';
import {OutputStatusBoard} from './statusBoard';
import {WakeKeeper, keepAwakeWhileOutputsOn} from './wakeLock';

/** What the output windows hang on. */
export interface OutputContext {
  readonly store: LiveStore;
  readonly control: BrowserWindow;
  readonly log: Logger;
  /** `offscreen` keeps the output windows off the screen (UI tests). */
  readonly windowMode: WindowMode;
}

interface StatusPublishing {
  readonly board: OutputStatusBoard;
  readonly outputs: OutputManager;
  readonly log: Logger;
}

function publishStatus({
  board,
  outputs,
  log,
}: StatusPublishing): Array<() => void> {
  return [
    answerWindows(Channels.outputStatusGet, () => board.snapshot()),
    listenToWindows(
      Channels.outputRetry,
      handleRetryRequest(screenId => outputs.retry(screenId), log),
    ),
    board.subscribe(statuses =>
      sendToWindows(Channels.outputStatusChanged, statuses, log),
    ),
  ];
}

/** The outputs while they run. */
export interface RunningOutputs {
  /**
   * Closes every output window, stops watching, and lets the display sleep.
   * Calling it again does nothing.
   */
  readonly stop: () => void;
  /** The last frame rate of each screen that has reported one. */
  readonly frameRates: () => readonly ScreenFrameRate[];
}

/**
 * Starts watching the monitors and the output switches, opens the output
 * windows as outputs turn on, follows their frame rate reports, and publishes
 * the output status (`output:status:get`, `output:status:changed`) and
 * handles 다시 시도 (`output:retry`). Call it after the app is ready.
 *
 * Keeps the display awake while any output is on.
 */
export function startOutputs({
  store,
  control,
  log,
  windowMode,
}: OutputContext): RunningOutputs {
  const displays = new DisplayRegistry(createElectronDisplaySource(), log);
  const screens = createDefaultScreenSource(displays);
  const frameRates = new FrameRateTracker(
    screenId => screens.list().some(({id}) => id === screenId),
    log,
  );
  const board = new OutputStatusBoard({
    screenStates: () => outputs.screenStates(),
    frameRate: screenId => frameRates.current(screenId),
  });
  const outputs = new OutputManager({
    store,
    displays,
    screens,
    controlBounds: () => (control.isDestroyed() ? null : control.getBounds()),
    createHandle: (screen, events) =>
      createElectronOutputWindow(screen, events, {log, mode: windowMode}),
    log,
    onStatusChange: () => board.refresh(),
  });
  outputs.start();
  const stops = [
    listenToWindows(
      Channels.outputFrameRate,
      handleFrameRate(report => {
        frameRates.report(report);
        outputs.pageDrawn(report.screenId);
        board.refresh();
      }, log),
    ),
    ...publishStatus({board, outputs, log}),
    keepAwakeWhileOutputsOn(
      store,
      new WakeKeeper(createElectronWakeLock(), log),
    ),
  ];
  return {
    stop: () => {
      for (const stop of stops) stop();
      outputs.dispose();
      displays.dispose();
    },
    frameRates: () => frameRates.reported(screens.list().map(({id}) => id)),
  };
}
