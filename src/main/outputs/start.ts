import {NDI_DEFAULT_FPS} from '@core/schema/screens';
import type {SettingsReader} from '@core/schema/settingsReader';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {BrowserWindow, ipcMain} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import {MONITOR_LIST_MAX} from '@core/schema/monitors';
import {createElectronDisplaySource} from '../displays/electronSource';
import {toMonitorList} from '../displays/monitorList';
import {DisplayRegistry} from '../displays/registry';
import type {Rect} from '../displays/rect';
import {answerWindows, listenToWindows, sendToWindows} from '../ipc';
import type {LiveStore} from '../live/store';
import {parseFrameReadyReport} from '@core/schema/ipcPayloads';
import {
  parsePreviewControl,
  parsePreviewRequest,
} from '@core/schema/previewMirror';
import type {Logger} from '../log';
import type {WindowMode} from '../windows/testWindows';
import {
  handleFrameRate,
  handleOutputHealth,
  handlePresenterTransition,
  handleRetryRequest,
  handleShowWindowRequest,
} from '../rendererMessages';
import {createSettingsScreenSource} from './settingsScreens';
import {createDefaultScreenSource} from './defaultScreens';
import {createElectronWakeLock} from './electronWakeLock';
import {createElectronOutputWindow} from './electronWindow';
import {
  createPresentedOutputWindow,
  presentTransition,
} from './presentedWindow';
import {FrameRateTracker, type ScreenFrameRate} from './frameRates';
import {OutputManager} from './manager';
import {MonitorNumbers} from './monitorNumbers';
import {openNumberWindow} from './numberWindow';
import {OutputStatusBoard} from './statusBoard';
import {WakeKeeper, keepAwakeWhileOutputsOn} from './wakeLock';
import {assignInitialMonitors} from './initialMonitors';
import {findControlMonitor} from '../displays/monitor';
import {watchControlMonitor} from './controlMonitor';
import type {PlaybackProblemBoard} from './playbackProblems';
import type {ProblemFeed} from '../problemFeed';
import {createNdiOutput} from '../ndi/output';
import type {OutputScreen} from './screens';
import type {OutputWindowEvents} from './outputWindow';
import {
  ackPresenterMirror,
  hasPresenterMirror,
  subscribePresenterMirror,
} from './presenterMirror';
import {createAlphaMirror} from './alphaMirror';
import {PreviewFrameFanout} from './previewFrameFanout';

/** What the output windows hang on. */
export interface OutputContext {
  readonly problems?: ProblemFeed;
  readonly playbackProblems?: PlaybackProblemBoard;
  readonly onPrepared?: () => void;
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

interface StatusPublishing {
  readonly board: OutputStatusBoard;
  readonly outputs: OutputManager;
  readonly displays: DisplayRegistry;
  readonly log: Logger;
}

function publishStatus({
  board,
  outputs,
  displays,
  log,
}: StatusPublishing): Array<() => void> {
  return [
    answerWindows(outputEndpoints.status.channel, () => board.snapshot()),
    listenToWindows(
      outputEndpoints.retry.channel,
      handleRetryRequest(screenId => outputs.retry(screenId), log),
    ),
    listenToWindows(outputEndpoints.findMonitors.channel, () =>
      displays.refresh(),
    ),
    listenToWindows(
      outputEndpoints.showWindow.channel,
      handleShowWindowRequest(screenId => outputs.showWindow(screenId), log),
    ),
    board.subscribe(statuses =>
      sendToWindows(outputEndpoints.statusChanged.channel, statuses, log),
    ),
  ];
}

interface MonitorPublishing {
  readonly control: BrowserWindow;
  readonly displays: DisplayRegistry;
  readonly outputs: OutputManager;
  readonly controlBounds: () => Rect | null;
  readonly log: Logger;
}

function publishMonitors({
  control,
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
  const push = () =>
    sendToWindows(outputEndpoints.monitorsChanged.channel, list(), log);
  return [
    answerWindows(outputEndpoints.monitors.channel, list),
    displays.subscribe(push),
    outputs.subscribeAssignment(push),
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
  const makeElectronWindow = (
    screen: OutputScreen,
    events: OutputWindowEvents,
  ) =>
    createElectronOutputWindow(screen, events, {
      ...(playbackProblems === undefined ? {} : {playbackProblems}),
      log,
      mode: windowMode,
      control,
    });
  // NOTE(0913vision): Full screen outputs show through a presenter at their
  // monitor's own refresh on Windows; test windows stay offscreen Electron
  // windows so nothing appears on screen.
  const presented =
    presenter &&
    process.platform === 'win32' &&
    windowMode === 'normal' &&
    process.env['LLP_NO_PRESENTER'] !== '1';
  const makeWindowTarget = (
    screen: OutputScreen,
    events: OutputWindowEvents,
  ) =>
    presented
      ? createPresentedOutputWindow(screen, events, {
          log,
          ...(playbackProblems === undefined ? {} : {playbackProblems}),
          window: () => makeElectronWindow(screen, events),
        })
      : makeElectronWindow(screen, events);
  const targetRegistry = {
    fullscreen: makeWindowTarget,
    window: makeWindowTarget,
    capture: makeWindowTarget,
    ndi: (screen: OutputScreen, events: OutputWindowEvents) =>
      createNdiOutput(screen, events, {
        log,
        onAcceleration: value => board.setNdiAcceleration(screen.id, value),
        onFailure: (id, missing) => {
          if (missing) problems?.report({kind: 'ndi-runtime-missing'});
          else problems?.report({kind: 'ndi-failed'});
          screens.failNdi(id);
        },
      }),
  };
  const outputs = new OutputManager({
    store,
    displays,
    screens,
    controlBounds,
    createHandle: (screen, events) =>
      targetRegistry[screen.target ?? screen.method](screen, events),
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
    if (screens.ready && screens.list().length === 0) onPrepared?.();
  });
  outputs.start();
  const previewSubscriptions = new Map<string, () => void>();
  const alphaMirrors = new Map<string, ReturnType<typeof createAlphaMirror>>();
  const previewSinks = new Map<string, (frame: Uint8Array | null) => void>();
  const fanouts = new Map<string, PreviewFrameFanout>();
  const waitingUpstream = new Set<string>();
  const clientStops = new Map<string, Map<number, () => void>>();
  const previewWindow = (id: number): BrowserWindow | undefined => {
    const win = BrowserWindow.getAllWindows().find(
      value => !value.isDestroyed() && value.webContents.id === id,
    );
    if (win === undefined || win.webContents.isDestroyed()) return undefined;
    if (win === control) return win;
    try {
      const url = new URL(win.webContents.getURL());
      return win.getParentWindow() === control &&
        url.pathname.endsWith('/index.html') &&
        url.searchParams.get('window') === 'settings'
        ? win
        : undefined;
    } catch {
      return undefined;
    }
  };
  const stopAlpha = (screenId: string): void => {
    alphaMirrors.get(screenId)?.stop();
    alphaMirrors.delete(screenId);
  };
  const ensureAlpha = (screenId: string): boolean => {
    const screen = screens.list().find(item => item.id === screenId);
    const contents = outputs.previewContents(screenId);
    const needed = screen?.target === 'ndi' || contents?.isOffscreen() === true;
    const sink = previewSinks.get(screenId);
    if (
      needed &&
      sink !== undefined &&
      !hasPresenterMirror(screenId) &&
      !alphaMirrors.has(screenId)
    ) {
      alphaMirrors.set(
        screenId,
        createAlphaMirror({
          source: () => outputs.previewContents(screenId),
          outputActive: () => store.state.outputs[screenId] === true,
          send: sink,
        }),
      );
    }
    return needed;
  };
  const ackUpstream = (screenId: string): void => {
    if (!waitingUpstream.delete(screenId)) return;
    const alpha = alphaMirrors.get(screenId);
    if (alpha !== undefined) alpha.ack();
    else ackPresenterMirror(screenId);
  };
  const removeClient = (screenId: string, sender: number): void => {
    const stops = clientStops.get(screenId);
    stops?.get(sender)?.();
    stops?.delete(sender);
    const fanout = fanouts.get(screenId);
    fanout?.remove(sender);
    if (fanout !== undefined && !fanout.empty) {
      if (fanout.hasCapacity) ackUpstream(screenId);
      return;
    }
    waitingUpstream.delete(screenId);
    previewSubscriptions.get(screenId)?.();
    previewSubscriptions.delete(screenId);
    stopAlpha(screenId);
    previewSinks.delete(screenId);
    fanouts.delete(screenId);
    clientStops.delete(screenId);
  };
  ipcMain.handle(
    outputEndpoints.previewSource.channel,
    (event, value: unknown) => {
      const request = parsePreviewRequest(value);
      if (
        !request.ok ||
        previewWindow(event.sender.id) === undefined ||
        control.isDestroyed()
      ) {
        return null;
      }
      const screen = screens
        .list()
        .find(item => item.id === request.value.screenId);
      if (screen === undefined) return null;
      if (ensureAlpha(screen.id)) return 'alpha';
      const output = BrowserWindow.getAllWindows().find(win => {
        if (win.isDestroyed() || win.webContents.isDestroyed()) return false;
        try {
          const url = new URL(win.webContents.getURL());
          return (
            url.pathname.endsWith('/output.html') &&
            url.searchParams.get('screen') === request.value.screenId
          );
        } catch {
          return false;
        }
      });
      return output?.webContents.getMediaSourceId(event.sender) ?? null;
    },
  );
  const stops = [
    () => {
      for (const clients of clientStops.values()) {
        for (const stop of clients.values()) stop();
      }
      clientStops.clear();
      for (const unsubscribe of previewSubscriptions.values()) unsubscribe();
      previewSubscriptions.clear();
      alphaMirrors.clear();
      previewSinks.clear();
      fanouts.clear();
      waitingUpstream.clear();
    },
    listenToWindows(outputEndpoints.previewControl.channel, (value, sender) => {
      const parsed = parsePreviewControl(value);
      const win = previewWindow(sender);
      if (!parsed.ok || control.isDestroyed() || win === undefined) return;
      const {screenId, action} = parsed.value;
      if (action === 'ack') {
        const fanout = fanouts.get(screenId);
        fanout?.ack(sender);
        if (fanout?.hasCapacity) ackUpstream(screenId);
        return;
      }
      removeClient(screenId, sender);
      if (
        action !== 'start' ||
        !screens.list().some(screen => screen.id === screenId)
      ) {
        return;
      }
      let fanout = fanouts.get(screenId);
      if (fanout === undefined) {
        fanout = new PreviewFrameFanout();
        fanouts.set(screenId, fanout);
      }
      const destroyed = (): void => removeClient(screenId, sender);
      win.webContents.once('destroyed', destroyed);
      const clients =
        clientStops.get(screenId) ?? new Map<number, () => void>();
      clients.set(sender, () =>
        win.webContents.removeListener('destroyed', destroyed),
      );
      clientStops.set(screenId, clients);
      fanout.add(sender, frame => {
        if (win.isDestroyed() || win.webContents.isDestroyed()) {
          removeClient(screenId, sender);
          return;
        }
        try {
          win.webContents.send(outputEndpoints.previewFrame.channel, {
            screenId,
            frame,
          });
        } catch (error) {
          log.warn('could not send presenter preview frame', error);
          removeClient(screenId, sender);
        }
      });
      if (previewSubscriptions.has(screenId)) return;
      const send = (frame: Uint8Array | null): void => {
        if (frame === null) waitingUpstream.delete(screenId);
        else waitingUpstream.add(screenId);
        const fanout = fanouts.get(screenId);
        fanout?.publish(frame);
        if (frame !== null && (fanout === undefined || fanout.hasCapacity)) {
          ackUpstream(screenId);
        }
      };
      previewSinks.set(screenId, send);
      const unsubscribe = subscribePresenterMirror(
        screenId,
        send,
        available => {
          if (available) stopAlpha(screenId);
          else ensureAlpha(screenId);
        },
      );
      previewSubscriptions.set(screenId, () => {
        unsubscribe();
        stopAlpha(screenId);
        previewSinks.delete(screenId);
      });
    }),
    () => ipcMain.removeHandler(outputEndpoints.previewSource.channel),
    stopInitialMonitors,
    releaseResync,
    releaseNumbers,
    () => numbers.dispose(),
    stopRetaining,
    answerWindows(outputEndpoints.frameReady.channel, (_event, value) => {
      const report = parseFrameReadyReport(value);
      if (!report.ok) {
        log.error('invalid output frame ready report', report.error);
        return false;
      }
      const shown = outputs.frameReady(
        report.value.screenId,
        report.value.version,
        report.value,
      );
      if (outputs.allPrepared()) onPrepared?.();
      return shown;
    }),
    screens.subscribe(() => board.refresh()),
    displays.subscribe(() => board.refresh()),
    listenToWindows(
      outputEndpoints.health.channel,
      handleOutputHealth(screenId => {
        frameRates.forget(screenId);
        outputs.frameReported(screenId);
        board.refresh();
      }, log),
    ),
    listenToWindows(
      outputEndpoints.presenterTransition.channel,
      handlePresenterTransition(
        ({screenId, transition}) => presentTransition(screenId, transition),
        log,
      ),
    ),
    listenToWindows(
      outputEndpoints.frameRate.channel,
      handleFrameRate(report => {
        const {screenId} = report;
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
    ...publishStatus({board, outputs, displays, log}),
    ...publishMonitors({control, displays, outputs, controlBounds, log}),
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
