import {app, BrowserWindow, type WebContents} from 'electron';
import {
  windowEndpoints,
  PREFERENCES_REQUEST_LIMIT,
  type SettingsRequest,
} from '@contracts/ipc/window';
import type {PreferencePageId} from '@core/schema/preferencePages';
import type {AppConfigFile} from '../store/appConfigFile';
import {IpcHost, pushToWindow} from '../base/ipcHost';
import {logWindowResponsiveness} from '../base/responsiveness';
import {registerControlClose, type ControlClose} from './controlClose';
import {
  createPreferencesWindow,
  preferencesBounds,
  type SettingsWindowFrameOptions,
} from './settingsWindowFrame';
import {
  applyScreensBounds,
  rememberScreensWindow,
  type ScreensWindowConfig,
} from './screens';

export interface SettingsWindowOptions extends SettingsWindowFrameOptions {
  readonly config?: Pick<
    AppConfigFile,
    | 'preferencesWindow'
    | 'setPreferencesWindow'
    | 'preferencesPage'
    | 'setPreferencesPage'
  >;
  readonly screens?: {
    readonly config: ScreensWindowConfig;
  };
}

export interface SettingsWindowRegistration {
  readonly close: (requireSaved?: boolean) => Promise<boolean>;
  readonly dispose: () => Promise<void>;
  readonly replaceControl: (control: BrowserWindow) => void;
}

type Target = Pick<SettingsRequest, 'view' | 'page'>;
const PREFERENCES: Target = {view: 'preferences', page: 'general'};
const WARMUP_DELAY_MS = 1000;

/** Owns one native settings window and warms its views in the same renderer. */
export function registerSettingsWindow(
  options: SettingsWindowOptions,
): SettingsWindowRegistration {
  return new PreparedSettingsWindow(options);
}

class PreparedSettingsWindow implements SettingsWindowRegistration {
  private control: BrowserWindow;
  private win: BrowserWindow | null = null;
  private closing: ControlClose | undefined;
  private disposed = false;
  private stopping = false;
  private wanted = false;
  private rendered = false;
  private presented: SettingsRequest | null = null;
  private applyingGeometry = false;
  private geometryView: SettingsRequest['view'] | null = null;
  private opener: BrowserWindow | null = null;
  private warmup: ReturnType<typeof setTimeout> | undefined;
  private warmTargets: Target[] = [];
  private preferencesPage: PreferencePageId = 'general';
  private request: SettingsRequest = {
    ...PREFERENCES,
    requestId: 0,
    preparing: true,
  };

  private readonly ipc: IpcHost;

  constructor(private readonly options: SettingsWindowOptions) {
    this.control = options.control;
    this.preferencesPage = options.config?.preferencesPage ?? 'general';
    this.ipc = new IpcHost(options.log);
    this.listen();
    options.control.once('closed', this.controlClosed);
    options.control.webContents.once('did-finish-load', this.scheduleWarmup);
    if (!options.control.webContents.isLoadingMainFrame()) {
      this.scheduleWarmup();
    }
  }

  readonly replaceControl = (control: BrowserWindow): void => {
    const previous = this.control;
    previous.removeListener('closed', this.controlClosed);
    if (!previous.webContents.isDestroyed()) {
      previous.webContents.removeListener(
        'did-finish-load',
        this.scheduleWarmup,
      );
    }
    this.control = control;
    if (this.win !== null && !this.win.isDestroyed()) {
      this.win.setParentWindow(control);
    }
    control.once('closed', this.controlClosed);
    control.webContents.once('did-finish-load', this.scheduleWarmup);
    if (!control.webContents.isLoadingMainFrame()) this.scheduleWarmup();
  };

  private nextId(): number {
    return (this.request.requestId + 1) % PREFERENCES_REQUEST_LIMIT;
  }

  private listen(): void {
    const {ipc} = this;
    ipc.message(windowEndpoints.openPreferences, page => {
      if (page === null) {
        this.open({view: 'preferences', page: this.preferencesPage});
      } else this.open({view: 'preferences', page}, true);
    });
    if (this.options.screens !== undefined) {
      ipc.signal(windowEndpoints.openScreens, () => {
        this.open({view: 'screens', page: this.preferencesPage});
      });
    }
    ipc.query(windowEndpoints.settingsRequest, () => this.request);
    ipc.request(
      windowEndpoints.beginSettingsRequest,
      (request, {contents}) =>
        this.isCurrent(request, contents) && this.accept(request),
    );
    ipc.message(windowEndpoints.settingsReady, (request, {contents}) => {
      if (!this.isCurrent(request, contents)) return;
      this.painted().catch((error: unknown) =>
        this.options.log.error('could not prepare the settings frame', error),
      );
    });
    ipc.message(
      windowEndpoints.rejectSettingsRequest,
      (request, {contents}) => {
        if (this.isCurrent(request, contents)) this.reject();
      },
    );
  }

  private open(target: Target, force = false): void {
    if (this.disposed || this.stopping) return;
    if (!this.wanted) {
      this.opener =
        this.options.mode === 'normal'
          ? (BrowserWindow.getFocusedWindow() ?? this.control)
          : null;
    }
    this.wanted = true;
    this.warmTargets = [];
    if (
      !force &&
      this.win !== null &&
      this.rendered &&
      !this.request.preparing &&
      this.request.view === target.view &&
      this.request.page === target.page
    ) {
      if (this.presented === this.request) {
        this.show();
        return;
      }
      this.reveal().catch((error: unknown) =>
        this.options.log.error('could not paint the settings frame', error),
      );
      return;
    }
    const existing = this.win !== null && !this.win.isDestroyed();
    this.select(target, false);
    this.prepare();
    this.win?.webContents.setBackgroundThrottling(false);
    this.win?.contentView.setVisible(true);
    if (this.options.mode === 'offscreen') {
      this.win?.webContents.startPainting();
    }
    if (existing) this.pushRequest();
    if (this.win?.isVisible() && this.options.mode === 'normal') {
      this.win.focus();
    }
  }

  private select(target: Target, preparing: boolean): void {
    this.request = {...target, requestId: this.nextId(), preparing};
    this.rendered = false;
    this.presented = null;
  }

  private pushRequest(): void {
    const contents = this.win?.webContents;
    if (contents === undefined) return;
    pushToWindow(contents, windowEndpoints.showSettingsRequest, {
      value: this.request,
      log: this.options.log,
    });
  }

  private prepare(): void {
    if (this.disposed || this.stopping || this.control.isDestroyed()) {
      return;
    }
    if (this.win !== null && !this.win.isDestroyed()) return;
    clearTimeout(this.warmup);
    this.rendered = false;
    this.geometryView = null;
    if (!this.wanted && this.options.screens !== undefined) {
      this.warmTargets = [
        {view: 'screens', page: 'general'},
        {view: 'preferences', page: 'shortcuts'},
        PREFERENCES,
      ];
    }
    const win = createPreferencesWindow(this.options);
    logWindowResponsiveness(win, 'settings', this.options.log);
    this.win = win;
    this.closing = registerControlClose({
      control: win,
      log: this.options.log,
      close: this.hide,
    });
    win.on('move', this.remember);
    win.on('resize', this.remember);
    win.webContents.on('did-start-loading', () => {
      this.rendered = false;
      this.presented = null;
      win.hide();
      win.setOpacity(0);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      if (win.isDestroyed() || details.reason === 'clean-exit') return;
      this.rendered = false;
      this.presented = null;
      win.hide();
      win.setOpacity(0);
      this.request = {...this.request, requestId: this.nextId()};
    });
    win.once('closed', this.closed);
  }

  /** Whether a window answers what it was asked for last. */
  private isCurrent(request: SettingsRequest, contents: WebContents): boolean {
    return (
      contents.id === this.win?.webContents.id &&
      request.requestId === this.request.requestId &&
      request.view === this.request.view &&
      request.page === this.request.page &&
      request.preparing === this.request.preparing
    );
  }

  private accept(request: SettingsRequest): boolean {
    const win = this.win;
    if (win === null || win.isDestroyed()) return false;
    if (request.view === 'screens' && this.options.screens === undefined) {
      return false;
    }
    // NOTE(0913vision): Resizing a hidden native view can start GPU raster work.
    // Warm the data at the prepared size; apply the requested frame on open.
    if (request.preparing) return true;
    if (this.geometryView === request.view) return true;
    this.remember();
    if (this.options.mode === 'normal') {
      win.setOpacity(0);
      if (this.geometryView !== null || win.isVisible()) win.hide();
    }
    this.applyingGeometry = true;
    this.geometryView = request.view;
    try {
      if (request.view === 'screens' && this.options.screens !== undefined) {
        applyScreensBounds(win, this.options.screens.config, this.options.mode);
      } else {
        const bounds = preferencesBounds(
          this.control,
          this.options.config?.preferencesWindow,
        );
        if (this.options.mode === 'normal' && win.isMaximized()) {
          win.unmaximize();
        }
        win.setResizable(true);
        win.setMaximizable(false);
        win.setMinimumSize(
          Math.min(bounds.width, 1040),
          Math.min(bounds.height, 800),
        );
        win.setBounds(bounds);
      }
      win.setTitle(request.view === 'screens' ? '화면 설정' : '환경설정');
      win.webContents.setBackgroundThrottling(false);
    } finally {
      this.applyingGeometry = false;
    }
    return true;
  }

  private async painted(): Promise<void> {
    if (!this.request.preparing && this.geometryView !== this.request.view) {
      return;
    }
    this.rendered = true;
    if (this.wanted) {
      if (this.request.view === 'preferences') {
        this.preferencesPage = this.request.page;
        this.options.config?.setPreferencesPage(this.preferencesPage);
      }
      await this.reveal();
      return;
    }
    const next = this.warmTargets.shift();
    if (next !== undefined) {
      this.select(next, true);
      this.pushRequest();
    }
  }

  private reject(): void {
    this.select(
      {view: this.geometryView ?? 'preferences', page: this.preferencesPage},
      false,
    );
    this.pushRequest();
  }

  private async reveal(): Promise<void> {
    const win = this.win;
    const request = this.request;
    const active = (): boolean => this.wanted && this.rendered;
    if (
      !active() ||
      win === null ||
      win.isDestroyed() ||
      win.webContents.isDestroyed()
    ) {
      return;
    }
    // NOTE(0913vision): Capture only on an explicit open: it starts painting a
    // never-shown renderer without exposing its first incomplete native frame.
    if (this.options.mode === 'offscreen') {
      win.webContents.invalidate();
      return;
    }
    // NOTE(0913vision): A hidden capture does not prime the native swapchain.
    // Map the final-size frame transparently before capturing, including the
    // first open, then expose only the committed native content.
    if (!win.isVisible()) {
      win.setOpacity(0);
      win.showInactive();
    }
    await win.webContents.capturePage();
    if (
      this.win !== win ||
      win.isDestroyed() ||
      win.webContents.isDestroyed() ||
      this.request !== request ||
      !active()
    ) {
      return;
    }
    // NOTE(0913vision): The first frame delivers resized view measurements.
    // Capture their committed layout before the native window is revealed.
    await win.webContents.capturePage();
    if (
      this.win !== win ||
      win.isDestroyed() ||
      win.webContents.isDestroyed() ||
      this.request !== request ||
      !active()
    ) {
      return;
    }
    this.presented = request;
    win.setOpacity(1);
    this.show();
  }

  private show(): void {
    const win = this.win;
    if (win === null || this.options.mode === 'offscreen') return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  private readonly remember = (): void => {
    if (
      this.applyingGeometry ||
      !this.wanted ||
      this.win === null ||
      (this.geometryView !== 'screens' && this.geometryView !== 'preferences')
    ) {
      return;
    }
    if (this.geometryView === 'screens' && this.options.screens !== undefined) {
      rememberScreensWindow(
        this.win,
        this.options.screens.config,
        this.options.mode,
      );
    } else if (
      this.geometryView === 'preferences' &&
      this.options.mode === 'normal' &&
      !this.win.isDestroyed()
    ) {
      this.options.config?.setPreferencesWindow({
        ...this.win.getNormalBounds(),
        maximized: false,
      });
    }
  };

  private readonly hide = (): void => {
    if (this.win === null || this.win.isDestroyed()) return;
    this.remember();
    this.geometryView = null;
    this.win.hide();
    if (this.win.isDestroyed()) return;
    this.win.contentView.setVisible(false);
    const contents = this.win.webContents;
    if (!contents.isDestroyed()) {
      contents.setBackgroundThrottling(true);
      if (this.options.mode === 'offscreen') contents.stopPainting();
    }
    if (this.options.mode !== 'offscreen') {
      this.win.setOpacity(0);
      if (this.win.isMaximized()) this.win.unmaximize();
    }
    this.win.setMinimumSize(0, 0);
    this.win.setBounds({width: 0, height: 0});
    if (
      this.wanted &&
      this.options.mode === 'normal' &&
      !this.opener?.isDestroyed()
    ) {
      this.opener?.focus();
    }
    this.wanted = false;
    this.warmTargets = [];
    this.select({view: 'preferences', page: this.preferencesPage}, true);
    this.pushRequest();
    this.closing?.resume();
  };

  private readonly closed = (): void => {
    this.closing?.dispose();
    this.closing = undefined;
    this.win = null;
    this.presented = null;
    this.wanted = false;
    this.preferencesPage = this.options.config?.preferencesPage ?? 'general';
    this.request = {...PREFERENCES, requestId: this.nextId(), preparing: true};
    if (this.control.isDestroyed()) app.quit();
    else this.scheduleWarmup();
  };

  private readonly scheduleWarmup = (): void => {
    clearTimeout(this.warmup);
    if (this.disposed || this.stopping || this.control.isDestroyed()) {
      return;
    }
    this.warmup = setTimeout(() => {
      this.warmup = undefined;
      this.prepare();
    }, WARMUP_DELAY_MS);
  };

  readonly close = async (requireSaved = false): Promise<boolean> => {
    const current = this.win;
    if (current === null || current.isDestroyed()) return true;
    const confirmed = await this.closing?.confirmClose(requireSaved);
    if (current.isDestroyed()) return true;
    if (!confirmed) return false;
    if (this.win === current) {
      this.hide();
      if (this.stopping && !current.isDestroyed()) current.destroy();
    }
    return true;
  };

  private readonly controlClosed = (): void => {
    this.stopping = true;
    clearTimeout(this.warmup);
    this.close().catch((error: unknown) =>
      this.options.log.error('could not close the settings window', error),
    );
  };

  readonly dispose = async (): Promise<void> => {
    if (this.disposed) return;
    this.stopping = true;
    clearTimeout(this.warmup);
    if (!(await this.close())) {
      this.stopping = false;
      return;
    }
    this.disposed = true;
    this.ipc.close();
    const control = this.control;
    if (!control.isDestroyed()) {
      control.removeListener('closed', this.controlClosed);
      if (!control.webContents.isDestroyed()) {
        control.webContents.removeListener(
          'did-finish-load',
          this.scheduleWarmup,
        );
      }
    }
  };
}
