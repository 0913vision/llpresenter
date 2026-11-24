import {app, type BrowserWindow, type Details} from 'electron';
import {ShutdownCoordinator} from '../base/shutdown';
import type {Logger} from '../base/log';
import type {WindowMode} from '../base/renderers/testWindows';
import {registerPlaybackProblems} from '../outputs/health/playbackProblems';
import {prepareSoakGarbageCollection} from '../soak';
import {registerGpuTestHook} from '../windows/gpuTestHook';
import {startControlFeatures} from './controlFeatures';
import {ControlOwner} from './controlOwner';
import {openFoundation, type LaunchOptions} from './foundation';
import {Graphics, restartGpu} from './graphics';
import {startLiveShow} from './liveShow';
import {startServices} from './services';
import {shutdownSteps} from './shutdownPlan';

function quitAfterSmokeTest(
  win: BrowserWindow,
  logger: Logger,
  mode: WindowMode,
): void {
  const delayMs = Number(process.env['LLP_SMOKE_EXIT_MS'] ?? '0');
  if (delayMs <= 0) return;
  const closeLater = (): void => {
    setTimeout(() => {
      logger.info('smoke ok');
      win.close();
    }, delayMs);
  };
  // NOTE(0913vision): An offscreen window never shows, so the smoke test
  // waits for it to be ready instead.
  if (mode === 'offscreen') win.once('ready-to-show', closeLater);
  else win.once('show', closeLater);
}

/** Puts the parts of the app together. */
class Application {
  private control: ControlOwner | null = null;
  private graphics: Graphics | null = null;
  private lastGpuState: Pick<Details, 'reason' | 'exitCode'> | null = null;

  constructor(private readonly options: LaunchOptions) {}

  bringBack(): void {
    this.control?.bringBack();
  }

  childGone(details: Details): void {
    const {type, reason, exitCode} = details;
    if (type === 'GPU') {
      this.lastGpuState = {reason, exitCode};
      if (reason !== 'clean-exit') this.graphics?.request('gpu-loss');
    }
    this.options.log.error('child process gone', details);
  }

  async open(): Promise<void> {
    const {windowMode, log, shutdown} = this.options;
    const foundation = await openFoundation(this.options);
    const {store, data, problems} = foundation;
    const control = new ControlOwner({
      ...foundation,
      problems: problems.feed,
      onHang: scriptAnswered => this.controlHangs(scriptAnswered),
    });
    const services = startServices(foundation, win => control.isCurrent(win));
    this.control = control;
    const win = control.open({
      startMaximized:
        (await data.settings)?.preferences().general.startMaximized ?? true,
    });
    const features = startControlFeatures(foundation, services, control);
    const playbackProblems = registerPlaybackProblems({
      log,
      enabled: source =>
        source === 'audio' || store.state.outputs[source] === true,
      subscribe: changed => store.subscribe(changed),
    });
    const graphics = new Graphics(foundation, {
      control,
      settingsWindow: features.settingsWindow,
      playbackProblems,
    });
    this.graphics = graphics;
    if (
      windowMode === 'offscreen' &&
      !app.isPackaged &&
      process.env['LLP_TEST_GPU_CRASH'] === '1'
    ) {
      shutdown.add({
        name: 'stop GPU test hook',
        run: registerGpuTestHook(() => control.webContents, log),
      });
    }
    shutdown.add({
      name: 'stop graphics recovery',
      run: () => graphics.stopRecovery(),
    });
    const show = startLiveShow(foundation, services, {
      graphics,
      playbackProblems,
    });
    const steps = shutdownSteps({
      foundation,
      services,
      control,
      features,
      graphics,
      playbackProblems,
      show,
    });
    for (const step of steps) shutdown.add(step);
    quitAfterSmokeTest(win, log, windowMode);
    log.info('started', {
      version: app.getVersion(),
      electron: process.versions.electron,
    });
  }

  private controlHangs(scriptAnswered: boolean): void {
    const {log} = this.options;
    log.error('control window not responding', {
      lastGpuState: this.lastGpuState,
    });
    const restarted =
      scriptAnswered &&
      restartGpu(error =>
        log.warn('could not restart the stalled GPU process', error),
      );
    if (!restarted) this.graphics?.request('control-hang');
  }
}

/** Starts the app behind its splash window. */
export function start(
  splash: BrowserWindow,
  windowMode: WindowMode,
  log: LaunchOptions['log'],
): void {
  prepareSoakGarbageCollection();
  const shutdown = new ShutdownCoordinator({app, log});
  const application = new Application({splash, windowMode, log, shutdown});
  app.on('second-instance', () => application.bringBack());
  app.on('child-process-gone', (_event, details) =>
    application.childGone(details),
  );
  app.on('window-all-closed', () => app.quit());
  app
    .whenReady()
    .then(() => application.open())
    .catch((error: unknown) => {
      log.error('failed to start', error);
      if (!splash.isDestroyed()) splash.close();
      app.quit();
    });
}
