import {NDI_DEFAULT_FPS} from '@core/schema/screens/screens';
import type {SettingsReader} from '@core/schema/app/settingsReader';
import type {SettingsEdit} from '@core/schema/app/settingsDocuments';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {BrowserWindow} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import {MONITOR_LIST_MAX} from '@core/schema/screens/monitors';
import {createElectronDisplaySource} from '../displays/electronSource';
import {toMonitorList} from '../displays/monitorList';
import {DisplayRegistry} from '../displays/registry';
import type {Rect} from '../displays/rect';
import {IpcHost} from '../base/ipcHost';
import type {LiveStore} from '../live/store';
import type {Logger} from '../base/log';
import type {WindowMode} from '../base/renderers/testWindows';
import {createSettingsScreenSource} from './monitors/settingsScreens';
import {createDefaultScreenSource} from './monitors/defaultScreens';
import {createElectronWakeLock} from './electronWakeLock';
import {presentTransition} from './presenter/presentedWindow';
import {FrameRateTracker, type ScreenFrameRate} from './health/frameRates';
import {OutputManager, type PreparedScreens} from './manager';
import {MonitorNumbers} from './monitors/monitorNumbers';
import {openNumberWindow} from './monitors/numberWindow';
import {OutputStatusBoard} from './health/statusBoard';
import {WakeKeeper, keepAwakeWhileOutputsOn} from './wakeLock';
import {assignInitialMonitors} from './monitors/initialMonitors';
import {findControlMonitor} from '../displays/monitor';
import {watchControlMonitor} from './monitors/controlMonitor';
import type {PlaybackProblemBoard} from './health/playbackProblems';
import type {ProblemFeed} from '../base/problemFeed';
import {outputTargets} from './targets';
import {PreviewHub} from './previews/previewHub';

/** What the output windows hang on. */
export interface OutputContext {
  readonly problems?: ProblemFeed;
  readonly playbackProblems?: PlaybackProblemBoard;
  /** Told whenever a screen has its picture, and when there are no screens. */
  readonly onPrepared?: (screens: PreparedScreens) => void;
  readonly store: LiveStore;
  readonly settings: Promise<SettingsReader | null>;
  readonly saveScreenSettings?: (
    edit: SettingsEdit,
  ) => Promise<EditResult | null>;
  readonly control: BrowserWindow;
  readonly log: Logger;
  /** `offscreen` keeps the output windows off the screen (UI tests). */
  readonly windowMode: WindowMode;
  /**
   * Shows full screen outputs through a presenter at their monitor's own
   * refresh, on Windows in the normal window mode.
   */
  readonly presenter?: boolean;
}

function answerPreviews(ipc: IpcHost, previews: PreviewHub): void {
  ipc.request(outputEndpoints.previewSource, ({screenId}, {contents}) =>
    previews.sourceOf(screenId, contents),
  );
  ipc.message(outputEndpoints.previewPublish, (frame, {contents}) =>
    previews.publish(frame, contents),
  );
  ipc.message(outputEndpoints.previewControl, (control, {contents}) =>
    previews.control(control, contents),
  );
}

/** Hears what the output pages report about themselves. */
function hearOutputs(
  ipc: IpcHost,
  {
    store,
    outputs,
    frameRates,
    board,
    onPrepared,
  }: {
    readonly store: Pick<LiveStore, 'state'>;
    readonly outputs: OutputManager;
    readonly frameRates: FrameRateTracker;
    readonly board: OutputStatusBoard;
    readonly onPrepared: (screens: PreparedScreens) => void;
  },
): void {
  ipc.request(outputEndpoints.frameReady, report => {
    const {screenId, version} = report;
    const shown = outputs.frameReady(screenId, version, report);
    onPrepared(outputs.preparedScreens());
    return shown;
  });
  const reported = (screenId: string): void => {
    outputs.frameReported(screenId);
    board.refresh();
  };
  ipc.message(outputEndpoints.health, ({screenId}) => {
    frameRates.forget(screenId);
    reported(screenId);
  });
  ipc.message(outputEndpoints.frameRate, report => {
    const {screenId} = report;
    // NOTE(0913vision): An off output is a hidden window, which draws about
    // once a second, so only outputs that are on are judged.
    if (store.state.outputs[screenId] === true) {
      frameRates.report({...report, screenId});
    } else {
      frameRates.forget(screenId);
    }
    reported(screenId);
  });
  ipc.message(outputEndpoints.presenterTransition, ({screenId, transition}) =>
    presentTransition(screenId, transition),
  );
}

function publishStatus(
  ipc: IpcHost,
  {
    board,
    outputs,
    displays,
  }: {
    readonly board: OutputStatusBoard;
    readonly outputs: OutputManager;
    readonly displays: DisplayRegistry;
  },
): void {
  ipc.query(outputEndpoints.status, () => board.snapshot());
  ipc.message(outputEndpoints.retry, ({screenId}) => outputs.retry(screenId));
  ipc.message(outputEndpoints.showWindow, ({screenId}) =>
    outputs.showWindow(screenId),
  );
  ipc.signal(outputEndpoints.findMonitors, () => displays.refresh());
  ipc.whenClosed(
    board.subscribe(statuses =>
      ipc.push(outputEndpoints.statusChanged, statuses),
    ),
  );
}

function publishMonitors(
  ipc: IpcHost,
  {
    control,
    displays,
    outputs,
    controlBounds,
  }: {
    readonly control: BrowserWindow;
    readonly displays: DisplayRegistry;
    readonly outputs: OutputManager;
    readonly controlBounds: () => Rect | null;
  },
): void {
  const list = () =>
    toMonitorList({
      monitors: displays.monitors,
      controlBounds: controlBounds(),
      assignment: outputs.assignedMonitorIds,
      limit: MONITOR_LIST_MAX,
    });
  const push = () => ipc.push(outputEndpoints.monitorsChanged, list());
  ipc.query(outputEndpoints.monitors, list);
  ipc.whenClosed(displays.subscribe(push));
  ipc.whenClosed(outputs.subscribeAssignment(push));
  ipc.whenClosed(
    watchControlMonitor({
      control,
      displays,
      monitorId: () =>
        findControlMonitor(displays.monitors, controlBounds())?.id ?? null,
      changed: () => {
        outputs.controlMonitorChanged();
        push();
      },
    }),
  );
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
 * Starts watching the monitors and the output switches, preloads hidden output
 * windows when settings arrive, follows their frame rate reports, and publishes
 * the output status (`output:status:get`, `output:status:changed`) and
 * publishes the monitor list (`monitors:get`, `monitors:changed`), and
 * handles 다시 시도 (`output:retry`), 모니터 다시 찾기
 * (`output:find-monitors`), and 창 보기 (`output:show-window`). Call it after
 * the app is ready.
 *
 * Keeps the display awake while any output is on.
 */
export function startOutputs({
  problems,
  playbackProblems,
  onPrepared,
  store,
  settings,
  saveScreenSettings,
  control,
  log,
  windowMode,
  presenter = false,
}: OutputContext): RunningOutputs {
  let stopped = false;
  const displays = new DisplayRegistry(createElectronDisplaySource(log), log);
  const controlBounds = () =>
    control.isDestroyed() ? null : control.getBounds();
  const screens = createSettingsScreenSource(
    settings,
    log,
    createDefaultScreenSource(displays, controlBounds),
  );
  const frameRates = new FrameRateTracker(
    screenId => screens.list().some(({id}) => id === screenId),
    log,
  );
  frameRates.setTarget(screenId => {
    const screen = screens.list().find(({id}) => id === screenId);
    return screen?.target === 'ndi' ? (screen.ndi?.fps ?? NDI_DEFAULT_FPS) : 60;
  });
  const board = new OutputStatusBoard({
    screenStates: () => outputs.screenStates(),
    frameRate: screenId => frameRates.current(screenId),
    contentSize: screenId =>
      outputs.shownOutputs().find(value => value.screen.id === screenId)
        ?.contentSize,
  });
  const createHandle = outputTargets({
    control,
    log,
    windowMode,
    presenter,
    playbackProblems,
    problems,
    board,
    screens,
  });
  const outputs = new OutputManager({
    store,
    displays,
    screens,
    controlBounds,
    createHandle,
    log,
    onStatusChange: () => board.refresh(),
  });
  const releaseResync = store.connectScreenSettings(screens);
  const stopInitialMonitors =
    saveScreenSettings === undefined
      ? () => undefined
      : assignInitialMonitors({
          settings,
          displays,
          controlBounds,
          save: saveScreenSettings,
          log,
        });
  const numbers = new MonitorNumbers({
    monitors: () => displays.monitors,
    avoid: () => outputs.captureAreas(),
    outputs: () => outputs.shownOutputs(),
    open: spot => openNumberWindow(spot, log, windowMode),
    log,
  });
  const releaseNumbers = store.connectMonitorNumbers(numbers);
  const stopRetaining = screens.subscribe(() => {
    frameRates.retain(screens.list().map(({id}) => id));
    if (screens.ready && screens.list().length === 0) {
      onPrepared?.({done: 0, total: 0});
    }
  });
  outputs.start();
  const previews = new PreviewHub({
    control,
    store,
    screens: () => screens.list(),
    contentsOf: screenId => outputs.previewContents(screenId),
    log,
  });
  const ipc = new IpcHost(log);
  answerPreviews(ipc, previews);
  hearOutputs(ipc, {
    store,
    outputs,
    frameRates,
    board,
    onPrepared: screens => onPrepared?.(screens),
  });
  publishStatus(ipc, {board, outputs, displays});
  publishMonitors(ipc, {control, displays, outputs, controlBounds});
  const stops = [
    () => ipc.close(),
    () => previews.stop(),
    stopInitialMonitors,
    releaseResync,
    releaseNumbers,
    () => numbers.dispose(),
    stopRetaining,
    screens.subscribe(() => board.refresh()),
    displays.subscribe(() => board.refresh()),
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
