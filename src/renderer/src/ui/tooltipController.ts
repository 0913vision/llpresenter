/** The tooltip that is showing, and the element it belongs to. */
export interface ShownTooltip {
  /** The `useTooltip` instance that asked for it. */
  readonly owner: string;
  readonly target: HTMLElement;
}

/** The pointer rests this long on a target before its tooltip shows. */
export const TOOLTIP_DELAY_MS = 600;
/** Within this long after a tooltip closes, the next one shows at once. */
export const TOOLTIP_GRACE_MS = 300;

type Listener = () => void;

const CLOSING_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * The one tooltip timer of the app. At most one tooltip shows at a time; a
 * pointer that moves from one target to the next while a tooltip shows, or
 * soon after, gets the next tooltip with no delay.
 */
export class TooltipController {
  private shown: ShownTooltip | null = null;
  private pending: ShownTooltip | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private hiddenAt = Number.NEGATIVE_INFINITY;
  private listening = false;
  private readonly listeners = new Set<Listener>();
  private readonly closeAll = (): void => {
    this.hide();
  };

  /** The tooltip that shows now, for `useSyncExternalStore`. */
  readonly current = (): ShownTooltip | null => this.shown;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Asks to show a tooltip for a target, at once or after the delay. */
  request(request: ShownTooltip): void {
    this.clearTimer();
    if (this.shown !== null || this.withinGrace()) {
      this.show(request);
      return;
    }
    this.pending = request;
    this.listen();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pending = null;
      this.show(request);
    }, TOOLTIP_DELAY_MS);
  }

  /** Drops the tooltip of one owner, whether it shows or waits to show. */
  release(owner: string): void {
    if (this.pending?.owner === owner) {
      this.clearTimer();
      this.pending = null;
      this.stopListeningIfIdle();
    }
    if (this.shown?.owner === owner) this.hide();
  }

  /** Closes any tooltip at once, as a click, a key, or a scroll does. */
  hide(): void {
    this.clearTimer();
    this.pending = null;
    if (this.shown !== null) {
      this.shown = null;
      this.hiddenAt = Date.now();
      this.notify();
    }
    this.stopListeningIfIdle();
  }

  private show(request: ShownTooltip): void {
    this.shown = request;
    this.listen();
    this.notify();
  }

  private withinGrace(): boolean {
    return Date.now() - this.hiddenAt < TOOLTIP_GRACE_MS;
  }

  private clearTimer(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    for (const type of CLOSING_EVENTS) {
      window.addEventListener(type, this.closeAll, true);
    }
    window.addEventListener('blur', this.closeAll);
  }

  private stopListeningIfIdle(): void {
    if (!this.listening || this.shown !== null || this.pending !== null) return;
    this.listening = false;
    for (const type of CLOSING_EVENTS) {
      window.removeEventListener(type, this.closeAll, true);
    }
    window.removeEventListener('blur', this.closeAll);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** The controller that every tooltip in the window shares. */
export const tooltipController = new TooltipController();
