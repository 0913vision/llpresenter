import {screen as displays, type WebContents} from 'electron';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import {sameRect, type Rect, type Size} from '../../displays/rect';
import type {Logger} from '../../base/log';
import type {OutputWindowEvents} from '../outputWindow';
import type {OutputScreen} from '../screens';
import type {PlaybackProblemBoard} from '../health/playbackProblems';
import {
  PRESENTER_STALL_MS,
  PresenterFrames,
  type PageTexture,
} from './presenterFrames';
import {PresenterMirror} from './presenterMirror';
import {PresenterPage} from './presenterPage';
import {PresenterProcess, type PresenterMessage} from './presenterProcess';

const UTILITY_TIMEOUT_MS = 5000;
const FIRST_TEXTURE_TIMEOUT_MS = 5000;
const DEFAULT_REFRESH_HZ = 60;

// NOTE(0913vision): Chromium paces every window by the primary display's
// vblank on Windows. A full screen output on a monitor with another refresh
// rate therefore shows its frames unevenly, and a moving wipe edge reads as a
// band. Full screen outputs draw their page offscreen and hand each frame to a
// presenter window on the monitor, which shows it at that monitor's own
// refresh and blends slide transitions there.

/** Hands a slide transition of one screen's page to its presenter. */
const transitionTargets = new Map<string, (effect: SlideTransition) => void>();

/** Ends the transition `screenId` is in and starts this one, unless it's a cut. */
export function presentTransition(
  screenId: string,
  effect: SlideTransition,
): void {
  transitionTargets.get(screenId)?.(effect);
}

/** One screen's page drawn offscreen and shown by its presenter process. */
export interface PresenterPart {
  previewContents(): WebContents | null;
  prepare(bounds: Rect): void;
  show(bounds: Rect, onTop: boolean): void;
  setOnTop(onTop: boolean): void;
  hide(): void;
  contentSize(): Size;
  bounds(): Rect | null;
  configure(screen: OutputScreen): void;
  reload(): Promise<void>;
  crashRenderer(): void;
  ping(): Promise<void>;
  destroy(): void;
}

/** What a presenter part uses from outside. */
export interface PresenterPartOptions {
  readonly log: Logger;
  readonly playbackProblems: PlaybackProblemBoard | undefined;
  /** It cannot go on; the screen falls back to its output window. */
  readonly fail: (reason: unknown) => void;
}

/**
 * The presenter of one screen: its page drawn offscreen, the frames on their
 * way, and the presenter process that shows them on the monitor. `fail` runs
 * when it cannot go on, and the screen falls back to its output window.
 */
export function createPresenterPart(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: PresenterPartOptions,
): PresenterPart {
  return new Presenter(screen, events, options);
}

/** One time limit at a time; when it runs out, the presenter cannot go on. */
class Deadline {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ranOut: (reason: string) => void) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(ms: number, reason: string): void {
    this.stop();
    this.timer = setTimeout(() => this.ranOut(reason), ms);
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

class Presenter implements PresenterPart {
  /** The screen it presents, under which its transitions are found. */
  private readonly screenId: string;
  private current: OutputScreen;
  private closed = false;
  /** The presenter process has its window open on the monitor. */
  private ready = false;
  /** The monitor place and refresh the presenter was opened for. */
  private openKey = '';
  private shown: Rect | null = null;
  private onTop = true;
  private readonly page: PresenterPage;
  private readonly process: PresenterProcess;
  private readonly frames: PresenterFrames;
  private readonly mirror: PresenterMirror;
  private readonly deadline: Deadline;
  private readonly transition = (effect: SlideTransition): void => {
    this.post({
      type: 'transition',
      kind: effect.kind,
      dir: effect.dir ?? 'left',
      sec: effect.sec,
    });
  };

  constructor(
    screen: OutputScreen,
    events: OutputWindowEvents,
    private readonly options: PresenterPartOptions,
  ) {
    this.screenId = screen.id;
    this.current = screen;
    this.page = new PresenterPage(screen, {
      events,
      playbackProblems: options.playbackProblems,
      name: () => this.current.name,
    });
    this.deadline = new Deadline(reason => this.failWith(reason));
    this.mirror = new PresenterMirror(
      () => this.current.id,
      message => this.post(message),
    );
    this.frames = new PresenterFrames({
      post: message => this.post({...message}),
      failed: reason => this.failWith(reason),
      stalled: () => {
        options.log.warn('output presenter stopped taking frames', {
          screen: this.current.id,
          waitedMs: PRESENTER_STALL_MS,
        });
        this.failWith('presenter stalled');
      },
    });
    this.process = new PresenterProcess({
      message: message => this.heard(message),
      failed: reason => this.failWith(reason),
      exited: code => {
        this.mirror.stop();
        this.failWith(`presenter exited ${code}`);
      },
    });
    this.page.onPaint(texture => this.painted(texture));
    transitionTargets.set(this.screenId, this.transition);
    this.page.load(error => this.failWith(error));
  }

  previewContents(): WebContents | null {
    return this.page.contents();
  }

  prepare(bounds: Rect): void {
    this.open(bounds);
  }

  show(bounds: Rect, onTop: boolean): void {
    this.onTop = onTop;
    if (this.shown === null || !sameRect(this.shown, bounds)) this.open(bounds);
    this.shown = bounds;
    this.post({type: 'show', topmost: onTop});
    if (this.ready) this.awaitFirstPicture();
  }

  setOnTop(onTop: boolean): void {
    this.onTop = onTop;
    this.post({type: 'top', topmost: onTop});
  }

  hide(): void {
    this.shown = null;
    this.mirror.stop();
    this.deadline.stop();
    this.post({type: 'hide'});
  }

  contentSize(): Size {
    return this.page.contentSize();
  }

  bounds(): Rect | null {
    return this.shown;
  }

  configure(next: OutputScreen): void {
    this.current = next;
    this.page.setTitle(next.name);
  }

  reload(): Promise<void> {
    return this.page.reload();
  }

  crashRenderer(): void {
    this.page.crash();
  }

  ping(): Promise<void> {
    return this.page.ping();
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    if (transitionTargets.get(this.screenId) === this.transition) {
      transitionTargets.delete(this.screenId);
    }
    this.mirror.stop();
    this.deadline.stop();
    this.frames.close();
    this.process.stop();
    this.page.destroy();
  }

  private failWith(reason: unknown): void {
    if (!this.closed) this.options.fail(reason);
  }

  private post(message: Record<string, unknown>): void {
    this.process.post(message);
  }

  /**
   * A frame of the page. A still page paints once, so its latest frame waits
   * until the presenter is ready instead of being dropped.
   */
  private painted(texture: PageTexture): void {
    if (this.closed) {
      texture.release();
      return;
    }
    if (this.shown !== null && this.ready) this.deadline.stop();
    this.frames.take(texture, this.process.running && this.ready);
  }

  /** A shown screen whose presenter gets no picture in time falls back. */
  private awaitFirstPicture(): void {
    if (this.shown === null || this.deadline.running) return;
    this.deadline.start(FIRST_TEXTURE_TIMEOUT_MS, 'no shared texture paint');
  }

  /** Opens the presenter on the monitor of `bounds`, at its refresh. */
  private open(bounds: Rect): void {
    const display = displays.getDisplayMatching(bounds);
    const pixels = displays.dipToScreenRect(null, bounds);
    const hz = Math.round(display.displayFrequency) || DEFAULT_REFRESH_HZ;
    const key = `${JSON.stringify(pixels)}@${hz}`;
    if (key === this.openKey) return;
    this.openKey = key;
    this.page.fit(bounds, hz);
    this.start();
    this.ready = false;
    this.post({type: 'open', bounds: pixels, hz, topmost: this.onTop});
    this.options.log.info('output presenter opened', {
      screen: this.current.id,
      ...pixels,
      hz,
    });
  }

  private start(): void {
    if (this.process.running || this.closed) return;
    if (!this.process.start()) return;
    this.deadline.start(UTILITY_TIMEOUT_MS, 'presenter startup timeout');
  }

  /** What the presenter process says about the window, frames and preview. */
  private heard(message: PresenterMessage): void {
    const {log} = this.options;
    switch (message.type) {
      case 'ready':
        this.ready = true;
        this.deadline.stop();
        if (!this.frames.sendWaiting()) this.page.repaint();
        this.awaitFirstPicture();
        break;
      case 'copied':
        this.frames.copied(message.id);
        break;
      case 'shown':
        this.deadline.stop();
        if (this.shown !== null) this.mirror.start();
        break;
      case 'mirror-frame':
        this.mirror.frame(message.frame);
        break;
      case 'mirror-error':
        log.warn('presenter preview unavailable', message.message);
        this.mirror.stop();
        break;
      case 'reopened':
        log.warn('output presenter window was gone; opened again', {
          screen: this.current.id,
        });
        // NOTE(0913vision): The new window shows once it has a frame; the
        // page paints one for it, and a window that never gets one falls
        // back like a presenter that never paints.
        if (this.frames.idle) this.page.repaint();
        this.awaitFirstPicture();
        break;
      case 'replaced':
        log.warn('output presenter window was moved or hidden; put back', {
          screen: this.current.id,
          was: message.was,
        });
        break;
      case 'transitioned':
        log.info('output presenter transition', {
          screen: this.current.id,
          ...message,
        });
        break;
      case 'error':
        this.failWith(message.message);
        break;
      default:
        break;
    }
  }
}
