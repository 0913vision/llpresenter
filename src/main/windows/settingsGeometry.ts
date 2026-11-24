import type {BrowserWindow} from 'electron';
import type {SettingsRequest} from '@contracts/ipc/window';
import {preferencesBounds} from './settingsWindowFrame';
import {applyScreensBounds, rememberScreensWindow} from './screens';
import type {SettingsWindowOptions} from './settingsWindow';

type SettingsView = SettingsRequest['view'];

/** The smallest the 환경설정 window may get, unless the display is smaller. */
const PREFERENCES_MIN_SIZE = {width: 1040, height: 800} as const;

/**
 * The size and place of the settings window for the view it shows: 환경설정
 * and 화면 설정 each keep their own bounds. The window takes a view's bounds
 * only when it is asked to show that view, and remembers them when the
 * operator moves or resizes it.
 */
export class SettingsGeometry {
  /** The view whose bounds the window has now; null while it is parked. */
  private shownView: SettingsView | null = null;
  /** True while the window is being sized, so its own resize is not saved. */
  private applying = false;

  constructor(private readonly options: SettingsWindowOptions) {}

  /** The view whose bounds the window has now, or null while it is parked. */
  get view(): SettingsView | null {
    return this.shownView;
  }

  /** Forgets the bounds the window has, as when it is hidden or remade. */
  forget(): void {
    this.shownView = null;
  }

  /**
   * Gives the window the bounds of `view`. It saves the bounds of the view it
   * leaves first (when the operator wants the window), and hides the window
   * while it changes, so no half-sized frame shows.
   */
  apply(
    win: BrowserWindow,
    view: SettingsView,
    {
      control,
      wanted,
    }: {readonly control: BrowserWindow; readonly wanted: boolean},
  ): void {
    const {mode, screens, config} = this.options;
    this.remember(win, wanted);
    if (mode === 'normal') {
      win.setOpacity(0);
      if (this.shownView !== null || win.isVisible()) win.hide();
    }
    this.applying = true;
    this.shownView = view;
    try {
      if (view === 'screens' && screens !== undefined) {
        applyScreensBounds(win, screens.config, mode);
      } else {
        this.applyPreferences(win, control, config?.preferencesWindow);
      }
      win.setTitle(view === 'screens' ? '화면 설정' : '환경설정');
      win.webContents.setBackgroundThrottling(false);
    } finally {
      this.applying = false;
    }
  }

  /**
   * Saves the window's bounds for the view it shows, when the operator wants
   * the window and it is not being sized by the app itself.
   */
  remember(win: BrowserWindow, wanted: boolean): void {
    const {mode, screens, config} = this.options;
    if (this.applying || !wanted || this.shownView === null) return;
    if (this.shownView === 'screens' && screens !== undefined) {
      rememberScreensWindow(win, screens.config, mode);
    } else if (
      this.shownView === 'preferences' &&
      mode === 'normal' &&
      !win.isDestroyed()
    ) {
      config?.setPreferencesWindow({
        ...win.getNormalBounds(),
        maximized: false,
      });
    }
  }

  private applyPreferences(
    win: BrowserWindow,
    control: BrowserWindow,
    saved: Parameters<typeof preferencesBounds>[1],
  ): void {
    const bounds = preferencesBounds(control, saved);
    if (this.options.mode === 'normal' && win.isMaximized()) win.unmaximize();
    win.setResizable(true);
    win.setMaximizable(false);
    win.setMinimumSize(
      Math.min(bounds.width, PREFERENCES_MIN_SIZE.width),
      Math.min(bounds.height, PREFERENCES_MIN_SIZE.height),
    );
    win.setBounds(bounds);
  }
}
