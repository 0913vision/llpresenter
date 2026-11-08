import {app, BrowserWindow, ipcMain, type IpcMainEvent} from 'electron';
import {
  windowEndpoints,
  PREFERENCES_REQUEST_LIMIT,
  type SettingsRequest,
} from '@contracts/ipc/window';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {guardTestPatterns} from '../outputs/testPatternGuard';
import {dispatchLogged} from '../live/store';
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
  readonly screens?: {
    readonly config: ScreensWindowConfig;
    readonly store: Parameters<typeof guardTestPatterns>[0]['store'];
  };
}

export interface SettingsWindowRegistration {
  readonly close: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
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
  private win: BrowserWindow | null = null;
  private closing: ControlClose | undefined;
  private stopPatterns: (() => void) | undefined;
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
  private requested: PreferencePageId | null = null;
  private preferencesPage: PreferencePageId = 'general';
  private request: SettingsRequest = {
    ...PREFERENCES,
    requestId: 0,
    preparing: true,
  };

  constructor(private readonly options: SettingsWindowOptions) {
    ipcMain.on(windowEndpoints.openPreferences.channel, this.openPreferences);
    ipcMain.on(windowEndpoints.openPreferencesAt.channel, this.openAt);
    if (options.screens !== undefined) {
      ipcMain.on(windowEndpoints.openScreens.channel, this.openScreens);
    }
    ipcMain.on(windowEndpoints.settingsReady.channel, this.ready);
    ipcMain.on(windowEndpoints.preferencesReady.channel, this.preferencesReady);
    ipcMain.on(windowEndpoints.rejectSettingsRequest.channel, this.reject);
    ipcMain.handle(windowEndpoints.settingsRequest.channel, () => this.request);
    ipcMain.handle(windowEndpoints.preferencesRequest.channel, () => ({
      requestId: this.request.requestId,
      page: this.request.page,
    }));
    ipcMain.handle(windowEndpoints.preferencesPage.channel, () => {
      const page = this.requested;
      this.requested = null;
      return page;
    });
    ipcMain.handle(
      windowEndpoints.beginSettingsRequest.channel,
      (event, value: unknown) => this.accept(event, value),
    );
    options.control.once('closed', this.controlClosed);
    options.control.webContents.once('did-finish-load', this.scheduleWarmup);
    if (!options.control.webContents.isLoadingMainFrame()) {
      this.scheduleWarmup();
    }
  }

  private nextId(): number {
    return (this.request.requestId + 1) % PREFERENCES_REQUEST_LIMIT;
  }

  private readonly openPreferences = (): void =>
    this.open({view: 'preferences', page: this.preferencesPage});
  private readonly openScreens = (): void =>
    this.open({view: 'screens', page: this.preferencesPage});
  private readonly openAt = (_event: unknown, value: unknown): void => {
    const page = windowEndpoints.openPreferencesAt.message(value);
    if (!page.ok) {
      this.options.log.warn(
        'dropped a malformed preferences page request',
        page.error,
      );
      return;
    }
    this.open({view: 'preferences', page: page.value}, true);
  };

  private open(target: Target, force = false): void {
    if (this.disposed || this.stopping) return;
    if (!this.wanted) {
      this.opener =
        this.options.mode === 'normal'
          ? (BrowserWindow.getFocusedWindow() ?? this.options.control)
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
    this.requested = target.page;
    this.rendered = false;
    this.presented = null;
  }

  private pushRequest(): void {
    const contents = this.win?.webContents;
    if (contents === undefined || contents.isDestroyed()) return;
    contents.send(windowEndpoints.showSettingsRequest.channel, this.request);
    if (this.request.view === 'preferences') {
      contents.send(
        windowEndpoints.showPreferencesPage.channel,
        this.request.page,
      );
    }
  }

  private prepare(): void {
    if (this.disposed || this.stopping || this.options.control.isDestroyed()) {
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
    this.win = win;
    this.closing = registerControlClose({
      control: win,
      log: this.options.log,
      close: this.hide,
    });
    if (this.options.screens !== undefined) {
      this.stopPatterns = guardTestPatterns({
        control: win,
        store: this.options.screens.store,
        log: this.options.log,
      });
    }
    win.on('move', this.remember);
    win.on('resize', this.remember);
    win.webContents.on('did-start-loading', () => {
      this.rendered = false;
      this.presented = null;
      win.hide();
      win.setOpacity(0);
      this.requested = this.request.page;
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      if (win.isDestroyed() || details.reason === 'clean-exit') return;
      this.rendered = false;
      this.presented = null;
      win.hide();
      win.setOpacity(0);
      this.request = {...this.request, requestId: this.nextId()};
      this.requested = this.request.page;
    });
    win.once('closed', this.closed);
  }

  private incoming(
    event: Pick<IpcMainEvent, 'sender'>,
    value: unknown,
  ): SettingsRequest | null {
    if (event.sender.id !== this.win?.webContents.id) return null;
    const parsed = windowEndpoints.settingsReady.message(value);
    if (!parsed.ok) return null;
    const request = parsed.value;
    return request.requestId === this.request.requestId &&
      request.view === this.request.view &&
      request.page === this.request.page &&
      request.preparing === this.request.preparing
      ? request
      : null;
  }

  private accept(event: Pick<IpcMainEvent, 'sender'>, value: unknown): boolean {
    const request = this.incoming(event, value);
    const win = this.win;
    if (request === null || win === null || win.isDestroyed()) return false;
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
        const bounds = preferencesBounds(this.options.control);
        if (this.options.mode === 'normal' && win.isMaximized()) {
          win.unmaximize();
        }
        win.setResizable(false);
        win.setMaximizable(false);
        win.setMinimumSize(bounds.width, bounds.height);
        win.setBounds(bounds);
      }
      win.setTitle(request.view === 'screens' ? '화면 설정' : '환경설정');
      win.webContents.setBackgroundThrottling(false);
    } finally {
      this.applyingGeometry = false;
    }
    return true;
  }

  private readonly ready = (event: IpcMainEvent, value: unknown): void => {
    this.painted(event, value).catch((error: unknown) =>
      this.options.log.error('could not prepare the settings frame', error),
    );
  };

  private async painted(event: IpcMainEvent, value: unknown): Promise<void> {
    if (
      this.incoming(event, value) === null ||
      (!this.request.preparing && this.geometryView !== this.request.view)
    ) {
      return;
    }
    this.rendered = true;
    if (this.wanted) {
      if (this.request.view === 'preferences') {
        this.preferencesPage = this.request.page;
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

  private readonly preferencesReady = (
    event: IpcMainEvent,
    value: unknown,
  ): void => {
    const parsed = windowEndpoints.preferencesReady.message(value);
    if (
      !parsed.ok ||
      this.request.view !== 'preferences' ||
      parsed.value.requestId !== this.request.requestId ||
      parsed.value.page !== this.request.page
    ) {
      return;
    }
    this.ready(event, this.request);
  };

  private readonly reject = (event: IpcMainEvent, value: unknown): void => {
    if (this.incoming(event, value) === null) return;
    this.select(
      {view: this.geometryView ?? 'preferences', page: this.preferencesPage},
      false,
    );
    this.pushRequest();
  };

  private async reveal(): Promise<void> {
    const win = this.win;
    const request = this.request;
    const active = (): boolean => this.wanted && this.rendered;
    if (!active() || win === null) {
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
      this.geometryView !== 'screens' ||
      this.win === null ||
      this.options.screens === undefined
    ) {
      return;
    }
    rememberScreensWindow(
      this.win,
      this.options.screens.config,
      this.options.mode,
    );
  };

  private readonly hide = (): void => {
    if (this.win === null || this.win.isDestroyed()) return;
    this.remember();
    this.geometryView = null;
    this.win.hide();
    this.win.contentView.setVisible(false);
    this.win.webContents.setBackgroundThrottling(true);
    if (this.options.mode === 'offscreen') {
      this.win.webContents.stopPainting();
    } else {
      this.win.setOpacity(0);
      if (this.win.isMaximized()) this.win.unmaximize();
    }
    this.win.setMinimumSize(0, 0);
    this.win.setBounds({width: 0, height: 0});
    const screens = this.options.screens;
    if (screens !== undefined) {
      for (const screenId of screens.store.state.testPatterns ?? []) {
        dispatchLogged(
          screens.store,
          {type: 'screen.testPattern.set', screenId, on: false},
          this.options.log,
        );
      }
    }
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
    this.stopPatterns?.();
    this.closing = undefined;
    this.stopPatterns = undefined;
    this.win = null;
    this.presented = null;
    this.wanted = false;
    this.preferencesPage = 'general';
    this.requested = null;
    this.request = {...PREFERENCES, requestId: this.nextId(), preparing: true};
    if (this.options.control.isDestroyed()) app.quit();
    else this.scheduleWarmup();
  };

  private readonly scheduleWarmup = (): void => {
    clearTimeout(this.warmup);
    if (this.disposed || this.stopping || this.options.control.isDestroyed()) {
      return;
    }
    this.warmup = setTimeout(() => {
      this.warmup = undefined;
      this.prepare();
    }, WARMUP_DELAY_MS);
  };

  readonly close = async (): Promise<boolean> => {
    const current = this.win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await this.closing?.confirmClose())) return false;
    if (!current.isDestroyed()) {
      this.hide();
      if (this.stopping) current.destroy();
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
    ipcMain.removeListener(
      windowEndpoints.openPreferences.channel,
      this.openPreferences,
    );
    ipcMain.removeListener(
      windowEndpoints.openPreferencesAt.channel,
      this.openAt,
    );
    ipcMain.removeListener(
      windowEndpoints.openScreens.channel,
      this.openScreens,
    );
    ipcMain.removeListener(windowEndpoints.settingsReady.channel, this.ready);
    ipcMain.removeListener(
      windowEndpoints.preferencesReady.channel,
      this.preferencesReady,
    );
    ipcMain.removeListener(
      windowEndpoints.rejectSettingsRequest.channel,
      this.reject,
    );
    for (const endpoint of [
      windowEndpoints.settingsRequest,
      windowEndpoints.preferencesRequest,
      windowEndpoints.preferencesPage,
      windowEndpoints.beginSettingsRequest,
    ]) {
      ipcMain.removeHandler(endpoint.channel);
    }
    this.options.control.removeListener('closed', this.controlClosed);
    this.options.control.webContents.removeListener(
      'did-finish-load',
      this.scheduleWarmup,
    );
  };
}
