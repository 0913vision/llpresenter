import type {BrowserWindow} from 'electron';
import {Channels} from '@shared/ipc';
import {MONITOR_LIST_MAX} from '@shared/schema/monitors';
import {createElectronDisplaySource} from '../displays/electronSource';
import {toMonitorList} from '../displays/monitorList';
import {DisplayRegistry} from '../displays/registry';
import type {Rect} from '../displays/rect';
import {answerWindows, listenToWindows, sendToWindows} from '../ipc';
import type {LiveStore} from '../live/store';
import {parseFrameReadyReport} from '@shared/schema/ipcPayloads';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import type {WindowMode} from '../windows/testWindows';
import {
  handleFrameRate,
  handleRetryRequest,
  handleShowWindowRequest,
} from '../rendererMessages';
import {createSettingsScreenSource} from './settingsScreens';
import {createDefaultScreenSource} from './defaultScreens';
import type {OutputScreen, ScreenSource} from './screens';
import {createElectronWakeLock} from './electronWakeLock';
import {createElectronOutputWindow} from './electronWindow';
import {FrameRateTracker, type ScreenFrameRate} from './frameRates';
import {OutputManager} from './manager';
import {MonitorNumbers} from './monitorNumbers';
import {openNumberWindow} from './numberWindow';
import {OutputStatusBoard} from './statusBoard';
import {guardTestPatterns} from './testPatternGuard';
import {WakeKeeper, keepAwakeWhileOutputsOn} from './wakeLock';

/** What the output windows hang on. */
export interface OutputContext {
  readonly store: LiveStore;
  readonly settings: Promise<SettingsReader | null>;
  readonly control: BrowserWindow;
  readonly log: Logger;
  /** `offscreen` keeps the output windows off the screen (UI tests). */
  readonly windowMode: WindowMode;
}

interface StatusPublishing {
  readonly board: OutputStatusBoard;
  readonly outputs: OutputManager;
  readonly displays: DisplayRegistry;
  readonly log: Logger;
  readonly screenIdFor: (id: string) => string;
}

function resolveScreenId(id: string, screens: ScreenSource): string {
  return (
    screens
      .list()
      .find(screen => screen.id === id || screen.aliases?.includes(id))?.id ??
    id
  );
}

function normalizeOutputFlags(
  screens: readonly OutputScreen[],
  store: LiveStore,
  log: Logger,
): void {
  const values = store.state.outputs;
  const commands = screens.flatMap(({id, aliases = []}) => {
    const keys = [id, ...aliases];
    const on = values[id] ?? keys.some(key => values[key] === true);
    return keys.some(key => (values[key] ?? false) !== on)
      ? [{type: 'output.set' as const, screenId: id, on}]
      : [];
  });
  if (commands.length > 0) {
    store.dispatch({type: 'live.batch', commands}, error =>
      log.error('live state listener failed', error),
    );
  }
}

function publishStatus({
  board,
  outputs,
  displays,
  log,
  screenIdFor,
}: StatusPublishing): Array<() => void> {
  return [
    answerWindows(Channels.outputStatusGet, () => board.snapshot()),
    listenToWindows(
      Channels.outputRetry,
      handleRetryRequest(screenId => outputs.retry(screenIdFor(screenId)), log),
    ),
    listenToWindows(Channels.outputFindMonitors, () => displays.refresh()),
    listenToWindows(
      Channels.outputShowWindow,
      handleShowWindowRequest(
        screenId => outputs.showWindow(screenIdFor(screenId)),
        log,
      ),
    ),
    board.subscribe(statuses =>
      sendToWindows(Channels.outputStatusChanged, statuses, log),
    ),
  ];
}

interface MonitorPublishing {
  readonly displays: DisplayRegistry;
  readonly outputs: OutputManager;
  readonly controlBounds: () => Rect | null;
  readonly log: Logger;
}

function publishMonitors({
  displays,
  outputs,
  controlBounds,
  log,
}: MonitorPublishing): Array<() => void> {
  const list = () =>
    toMonitorList({
      monitors: displays.monitors,
      controlBounds: controlBounds(),
      assignment: outputs.assignedMonitorIds,
      limit: MONITOR_LIST_MAX,
    });
  const push = () => sendToWindows(Channels.monitorsChanged, list(), log);
  return [
    answerWindows(Channels.monitorsGet, list),
    displays.subscribe(push),
    outputs.subscribeAssignment(push),
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
 * publishes the monitor list (`monitors:get`, `monitors:changed`), and
 * handles 다시 시도 (`output:retry`), 모니터 다시 찾기
 * (`output:find-monitors`), and 창 보기 (`output:show-window`). Call it after
 * the app is ready.
 *
 * Keeps the display awake while any output is on.
 */
export function startOutputs({
  store,
  settings,
  control,
  log,
  windowMode,
}: OutputContext): RunningOutputs {
  let stopped = false;
  const displays = new DisplayRegistry(createElectronDisplaySource(), log);
  const screens = createSettingsScreenSource(
    settings,
    log,
    createDefaultScreenSource(displays),
  );
  const screenIdFor = (id: string): string => resolveScreenId(id, screens);
  const frameRates = new FrameRateTracker(
    screenId => screens.list().some(({id}) => id === screenId),
    log,
  );
  const board = new OutputStatusBoard({
    screenStates: () => outputs.screenStates(),
    frameRate: screenId => frameRates.current(screenIdFor(screenId)),
  });
  const controlBounds = () =>
    control.isDestroyed() ? null : control.getBounds();
  const outputs = new OutputManager({
    store,
    displays,
    screens,
    controlBounds,
    createHandle: (screen, events) =>
      createElectronOutputWindow(screen, events, {
        log,
        mode: windowMode,
        control,
      }),
    log,
    onStatusChange: () => board.refresh(),
  });
  const releaseResync = store.connectScreenSettings(screens);
  const numbers = new MonitorNumbers({
    monitors: () => displays.monitors,
    avoid: () => outputs.captureAreas(),
    outputs: () => outputs.shownOutputs(),
    open: spot => openNumberWindow(spot, log, windowMode),
    log,
  });
  const releaseNumbers = store.connectMonitorNumbers(numbers);
  const stopNormalizing = screens.subscribe(() => {
    frameRates.retain(screens.list().map(({id}) => id));
    normalizeOutputFlags(screens.list(), store, log);
  });
  outputs.start();
  const stops = [
    releaseResync,
    releaseNumbers,
    guardTestPatterns({control, store, log}),
    () => numbers.dispose(),
    stopNormalizing,
    answerWindows(Channels.outputFrameReady, (_event, value) => {
      const report = parseFrameReadyReport(value);
      if (!report.ok) {
        log.error('invalid output frame ready report', report.error);
        return false;
      }
      return outputs.frameReady(
        screenIdFor(report.value.screenId),
        report.value.version,
        report.value,
      );
    }),
    screens.subscribe(() => board.refresh()),
    listenToWindows(
      Channels.outputFrameRate,
      handleFrameRate(report => {
        const screenId = screenIdFor(report.screenId);
        // NOTE(0913vision): An off output is a hidden window, which draws
        // about once a second, so only outputs that are on are judged.
        if (store.state.outputs[screenId] === true) {
          frameRates.report({...report, screenId});
        } else {
          frameRates.forget(screenId);
        }
        outputs.frameReported(screenId);
        board.refresh();
      }, log),
    ),
    ...publishStatus({board, outputs, displays, log, screenIdFor}),
    ...publishMonitors({displays, outputs, controlBounds, log}),
    keepAwakeWhileOutputsOn(
      store,
      new WakeKeeper(createElectronWakeLock(), log),
    ),
    () => outputs.dispose(),
    () => screens.dispose(),
    () => displays.dispose(),
  ];
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const stop of stops) {
        try {
          stop();
        } catch (error) {
          log.error('could not release an output resource', error);
        }
      }
    },
    frameRates: () => frameRates.reported(screens.list().map(({id}) => id)),
  };
}
