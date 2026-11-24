import {
  app,
  type BrowserWindow,
  type Rectangle,
  type WebContents,
} from 'electron';
import type {Logger} from '../base/log';
import type {ProblemFeed} from '../base/problemFeed';
import type {WindowMode} from '../base/testWindows';
import type {LaunchIdle} from '../store/launchIdle';
import type {UiZoomRegistration} from '../store/settings/uiZoom';
import {createControlWindow} from '../windows/control';
import {registerControlClose, type ControlClose} from '../windows/controlClose';
import {ControlHeartbeat} from '../windows/controlHeartbeat';
import {announceReloadAfterCrash} from '../windows/reloadNotice';
import {showStartupError} from '../windows/startupError';
import type {LaunchProgress} from './launchProgress';

/** The load error of a page that another load replaced. */
const ABORTED = -3;
const PAGE_STEPS = 3;
const ONE_PIXEL = {x: 0, y: 0, width: 1, height: 1};

/** Where a control window opens. */
export interface ControlPlacement {
  readonly startMaximized: boolean;
  readonly bounds?: Rectangle | undefined;
}

export interface ControlOwnerOptions {
  readonly windowMode: WindowMode;
  readonly launch: LaunchProgress;
  readonly launchIdle: Pick<LaunchIdle, 'prepared'>;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly problems: Pick<ProblemFeed, 'report'>;
  /**
   * The window stopped answering.
   *
   * @param scriptAnswered - Whether only its picture did.
   */
  readonly onHang: (scriptAnswered: boolean) => void;
  readonly log: Logger;
}

/** Owns the control window, which graphics recovery replaces with a new one. */
export class ControlOwner {
  private win: BrowserWindow | null = null;
  private closing: ControlClose | undefined;
  private stopReloadNotice: () => void = () => undefined;

  constructor(private readonly options: ControlOwnerOptions) {}

  /** The control window. It stays here after it closed. */
  get window(): BrowserWindow {
    if (this.win === null) throw new Error('There is no control window yet');
    return this.win;
  }

  get webContents(): WebContents {
    return this.window.webContents;
  }

  isCurrent(win: BrowserWindow): boolean {
    return win === this.win;
  }

  /** Opens a control window, in the place of the one before it. */
  open({startMaximized, bounds}: ControlPlacement): BrowserWindow {
    const {windowMode, launch, launchIdle, zoom, log} = this.options;
    launch.begin('window');
    const win = createControlWindow(log, windowMode, {
      attachControl: contents => zoom.attachControl(contents),
      outputsReady: launchIdle.prepared,
      startMaximized,
      onOverdue: () => launch.giveUp(),
      onOpen: () => {
        if (this.isCurrent(win)) launch.end();
      },
    });
    if (bounds !== undefined) win.setBounds(bounds);
    launch.finish('window');
    this.take(win);
    return win;
  }

  /** Brings the window back to the front, as a second launch does. */
  bringBack(): void {
    // NOTE(0913vision): A second launch never shows an offscreen control
    // window.
    if (this.options.windowMode === 'offscreen') return;
    if (this.win === null || this.win.isDestroyed()) return;
    if (this.win.isMinimized()) this.win.restore();
    this.win.focus();
  }

  async confirmClose(requireSaved?: boolean): Promise<boolean> {
    return (await this.closing?.confirmClose(requireSaved)) ?? true;
  }

  resumeClosing(): void {
    this.closing?.resume();
  }

  stopClosing(): void {
    this.closing?.dispose();
  }

  stopNotice(): void {
    this.stopReloadNotice();
  }

  private take(win: BrowserWindow): void {
    const {problems, log} = this.options;
    this.closing?.dispose();
    this.stopReloadNotice();
    this.win = win;
    this.watchLaunch(win);
    this.watchHeartbeat(win);
    win.once('closed', () => {
      if (this.isCurrent(win)) app.quit();
    });
    this.closing = registerControlClose({control: win, log});
    this.stopReloadNotice = announceReloadAfterCrash(win.webContents, () =>
      problems.report({kind: 'control-reloaded'}),
    );
  }

  private watchLaunch(win: BrowserWindow): void {
    const {windowMode, launch, log} = this.options;
    launch.begin('page');
    const steps = new Set(['dom', 'load', 'paint']);
    const step = (name: string): void => {
      if (!this.isCurrent(win) || !steps.delete(name)) return;
      launch.advance('page', PAGE_STEPS - steps.size, PAGE_STEPS);
      if (steps.size === 0) launch.finish('page');
    };
    win.webContents.once('dom-ready', () => step('dom'));
    win.webContents.once('did-finish-load', () => step('load'));
    win.once('ready-to-show', () => step('paint'));
    win.webContents.on('did-fail-load', (_event, code, ...details) => {
      const isMainFrame = details[2];
      if (
        !this.isCurrent(win) ||
        !launch.isShown ||
        !isMainFrame ||
        code === ABORTED
      ) {
        return;
      }
      log.error('control window failed to load during startup', {code});
      launch.fail('page', `load error ${code}`);
      launch.end();
      if (windowMode === 'normal') showStartupError();
      app.quit();
    });
  }

  private watchHeartbeat(win: BrowserWindow): void {
    const {windowMode, onHang} = this.options;
    let scriptAnswered = false;
    const heartbeat = new ControlHeartbeat(
      () => {
        scriptAnswered = false;
        const answer = win.webContents.executeJavaScript('0').then(() => {
          scriptAnswered = true;
        });
        const draws =
          windowMode === 'offscreen' || (win.isVisible() && !win.isMinimized());
        return draws
          ? Promise.all([answer, win.webContents.capturePage(ONE_PIXEL)])
          : answer;
      },
      () => onHang(scriptAnswered),
    );
    win.webContents.on('did-start-loading', () => heartbeat.stop());
    win.webContents.on('did-finish-load', () => heartbeat.start());
    win.once('closed', () => heartbeat.stop());
  }
}
