import {THEME_CANVAS} from '@core/schema/screens/screens';
import {BrowserWindow, type WebContents} from 'electron';
import type {Rect, Size} from '../../displays/rect';
import {
  blockNavigation,
  startLoading,
  type PageRequest,
} from '../../base/renderers/page';
import {APP_PAGE} from '../../base/renderers/pagePreferences';
import {
  watchPlaybackProblems,
  type PlaybackProblemBoard,
} from '../health/playbackProblems';
import {type OutputWindowEvents, OUTPUT_BACKGROUND} from '../outputWindow';
import type {OutputScreen} from '../screens';
import type {PageTexture} from './presenterFrames';

const DEFAULT_SIZE: Size = THEME_CANVAS;
const PING_SCRIPT = '0';
/** The most frames a second Chromium paints a page. */
const MAX_FRAME_RATE = 240;

/** What the page of a presenter tells and reads from outside. */
export interface PresenterPageOptions {
  readonly events: OutputWindowEvents;
  readonly playbackProblems: PlaybackProblemBoard | undefined;
  /** The name of the screen now, for its playback problems. */
  readonly name: () => string;
}

/**
 * The output page of one screen, drawn offscreen into shared textures that
 * its presenter shows. It never shows a window of its own.
 */
export class PresenterPage {
  private readonly win: BrowserWindow;
  private readonly request: PageRequest;
  private readonly releaseProblems: (() => void) | undefined;

  constructor(
    screen: OutputScreen,
    {events, playbackProblems, name}: PresenterPageOptions,
  ) {
    const size = screen.resolution ?? DEFAULT_SIZE;
    this.win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      width: size.width,
      height: size.height,
      useContentSize: true,
      frame: false,
      backgroundColor: OUTPUT_BACKGROUND,
      webPreferences: {
        ...APP_PAGE,
        backgroundThrottling: false,
        offscreen: {useSharedTexture: true},
      },
    });
    this.request = {
      name: 'output',
      query: {screen: screen.id, presenter: '1'},
    };
    blockNavigation(this.win);
    this.win.on('page-title-updated', event => event.preventDefault());
    this.win.webContents.on('render-process-gone', (_event, details) =>
      events.onRendererGone(details),
    );
    this.releaseProblems =
      playbackProblems === undefined
        ? undefined
        : watchPlaybackProblems(playbackProblems, this.win.webContents, {
            source: screen.id,
            name,
            retry: () => this.win.webContents.reload(),
          });
  }

  /** Hands each frame the page paints to `paint`. */
  onPaint(paint: (texture: PageTexture) => void): void {
    this.win.webContents.on('paint', event => {
      if (event.texture) paint(event.texture);
    });
  }

  /** Loads the page; `failed` is told when it cannot. */
  load(failed: (error: unknown) => void): void {
    void this.reload().catch(failed);
  }

  reload(): Promise<void> {
    return startLoading(this.win, this.request);
  }

  /**
   * Has the page paint a full frame again. invalidate() can paint a bitmap
   * without a texture in shared texture mode; restarting the painting gives a
   * full texture frame.
   */
  repaint(): void {
    if (this.win.isDestroyed()) return;
    this.win.webContents.stopPainting();
    this.win.webContents.startPainting();
  }

  /** Draws the page at the size of `bounds`, `hz` frames a second. */
  fit(bounds: Rect, hz: number): void {
    this.win.setContentSize(bounds.width, bounds.height);
    this.win.webContents.setFrameRate(
      Math.min(MAX_FRAME_RATE, Math.max(1, hz)),
    );
  }

  contents(): WebContents | null {
    return this.win.isDestroyed() ? null : this.win.webContents;
  }

  contentSize(): Size {
    const {width, height} = this.win.getContentBounds();
    return {width, height};
  }

  setTitle(title: string): void {
    this.win.setTitle(title);
  }

  crash(): void {
    if (!this.win.isDestroyed()) this.win.webContents.forcefullyCrashRenderer();
  }

  async ping(): Promise<void> {
    await this.win.webContents.executeJavaScript(PING_SCRIPT);
  }

  destroy(): void {
    this.releaseProblems?.();
    if (!this.win.isDestroyed()) this.win.destroy();
  }
}
