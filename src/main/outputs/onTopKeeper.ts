import type {Logger} from '../log';

/** How often a shown output that should stay on top checks that it still is. */
export const ON_TOP_CHECK_MS = 3000;

const OUTPUT_ON_TOP_LEVEL = 'screen-saver';

/** The part of an Electron window that the keeper reads and sets. */
export interface OnTopWindow {
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(flag: boolean, level?: typeof OUTPUT_ON_TOP_LEVEL): void;
  on(event: 'always-on-top-changed', listener: () => void): unknown;
  removeListener(event: 'always-on-top-changed', listener: () => void): unknown;
}

/**
 * Keeps an output window at the always-on-top level the app last set. When
 * the window leaves it, as Electron reports or as a check every
 * {@link ON_TOP_CHECK_MS} finds while it should be on top, the keeper puts it
 * back once and warns. Lost again before the next deliberate set, it logs an
 * error and leaves the window alone until then, as it does when reading or
 * setting the level throws.
 */
export class OnTopKeeper {
  private expected: boolean | null = null;
  private restored = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly win: OnTopWindow,
    private readonly log: Logger,
  ) {
    win.on('always-on-top-changed', this.check);
  }

  /** Sets the level on purpose and keeps it from now on. */
  set(onTop: boolean): void {
    this.expected = onTop;
    this.restored = false;
    this.setLevel(onTop);
    this.followChecks();
  }

  /** Stops keeping the level, as for a hidden output. */
  release(): void {
    this.expected = null;
    this.followChecks();
  }

  dispose(): void {
    this.release();
    this.win.removeListener('always-on-top-changed', this.check);
  }

  // NOTE(0913vision): Each check reads the window's level now rather than the
  // value an event carries, so a late event of an earlier set never looks
  // like a loss.
  private readonly check = (): void => {
    const {expected} = this;
    if (expected === null) return;
    try {
      this.keep(expected);
    } catch (error) {
      this.release();
      this.log.error(
        'could not keep an output window always on top; leaving it until the next change',
        error,
      );
    }
  };

  private keep(expected: boolean): void {
    if (this.win.isAlwaysOnTop() === expected) return;
    if (this.restored) {
      this.release();
      this.log.error(
        'an output window lost its always-on-top level again; leaving it until the next change',
        {alwaysOnTop: expected},
      );
      return;
    }
    this.restored = true;
    this.log.warn(
      'an output window lost its always-on-top level; restoring it',
      {
        alwaysOnTop: expected,
      },
    );
    this.setLevel(expected);
  }

  // NOTE(0913vision): Electron's default floating level moves the window
  // behind the Windows taskbar, which can remove its topmost style when the
  // taskbar itself is not topmost. screen-saver skips that native move.
  private setLevel(onTop: boolean): void {
    if (onTop) this.win.setAlwaysOnTop(true, OUTPUT_ON_TOP_LEVEL);
    else this.win.setAlwaysOnTop(false);
  }

  private followChecks(): void {
    const checking = this.expected === true;
    if (checking && this.timer === null) {
      this.timer = setInterval(this.check, ON_TOP_CHECK_MS);
    } else if (!checking && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
