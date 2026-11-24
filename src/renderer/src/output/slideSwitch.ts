import type {SlideTransition} from '@core/schema/slides/slideTransition';
import type {OutputRenderer} from '../rendering/outputRenderer';
import {SlideAnimation} from './slideAnimation';
import {waitForReady} from './waitForReady';

/**
 * A change with no visible transition, for a slide that moves onto another
 * background: its texts and the background change in one frame.
 */
export const CUT: SlideTransition = {kind: 'none', sec: 0.1};

interface SlideSwitchOptions {
  readonly create: () => OutputRenderer;
  /** Blends transitions at the monitor's own refresh; absent animates here. */
  readonly present?: ((effect: SlideTransition) => void) | undefined;
  /** Called when the next slide is shown although it isn't completely drawn. */
  readonly onLate: (renderer: OutputRenderer) => void;
  readonly onError: (message: string, error: unknown) => void;
}

/**
 * Changes the slide an output shows, as PowerPoint's show does. The next slide
 * is drawn completely out of sight and then shown with its own transition.
 * Leaving a slide ends a transition that still runs at once, so the next one
 * always starts from a whole slide.
 */
export class SlideSwitch {
  private current: OutputRenderer | null = null;
  private outgoing: OutputRenderer | null = null;
  private animation: SlideAnimation | null = null;
  private cancelReady: (() => void) | null = null;

  constructor(private readonly options: SlideSwitchOptions) {}

  /** The renderer that draws the live slide, created on first use. */
  renderer(): OutputRenderer {
    this.current ??= this.options.create();
    return this.current;
  }

  /** Whether the live slide is still drawn out of sight or comes in. */
  get changing(): boolean {
    return this.outgoing !== null;
  }

  /** Ends a running transition; the slide it was going to is shown whole. */
  end(): void {
    this.stopWaiting();
    this.options.present?.(CUT);
    this.settle();
  }

  /** Draws the next slide out of sight, then shows it with its transition. */
  change(
    effect: SlideTransition,
    {
      draw,
      complete,
    }: {
      readonly draw: () => void;
      readonly complete: (renderer: OutputRenderer) => boolean;
    },
  ): void {
    const waiting = this.cancelReady !== null;
    this.stopWaiting();
    this.options.present?.(CUT);
    // NOTE(0913vision): A slide that was never shown must not replace the
    // picture the screen still shows.
    if (waiting && this.outgoing !== null) {
      this.current?.dispose();
      this.current = this.outgoing;
      this.outgoing = null;
    }
    this.settle();
    const outgoing = this.renderer();
    outgoing.freeze();
    this.outgoing = outgoing;
    const incoming = this.options.create();
    this.current = incoming;
    incoming.transitionSurface().style.visibility = 'hidden';
    draw();
    const show = (): void => {
      this.cancelReady = null;
      this.show(outgoing, incoming, effect);
    };
    if (complete(incoming)) {
      show();
      return;
    }
    this.cancelReady = waitForReady(
      () => complete(incoming),
      show,
      () => this.options.onLate(incoming),
    );
  }

  dispose(): void {
    this.stopWaiting();
    this.animation?.cancel();
    this.outgoing?.dispose();
    this.current?.dispose();
    this.outgoing = null;
    this.current = null;
  }

  private show(
    outgoing: OutputRenderer,
    incoming: OutputRenderer,
    effect: SlideTransition,
  ): void {
    const surface = incoming.transitionSurface();
    try {
      if (this.options.present !== undefined) {
        this.options.present(effect);
        this.settle();
        return;
      }
      const animation = new SlideAnimation();
      this.animation = animation;
      animation.play(outgoing.transitionSurface(), surface, effect);
      surface.style.visibility = '';
      const done = (): void => {
        if (this.animation === animation) this.settle();
      };
      void animation.finished().then(done, done);
    } catch (error) {
      this.options.onError('could not animate the incoming slide', error);
      this.settle();
    }
  }

  private settle(): void {
    this.animation?.cancel();
    this.animation = null;
    if (this.current !== null) {
      const {style} = this.current.transitionSurface();
      style.visibility = '';
      style.opacity = '';
      style.zIndex = '';
    }
    this.outgoing?.dispose();
    this.outgoing = null;
  }

  private stopWaiting(): void {
    this.cancelReady?.();
    this.cancelReady = null;
  }
}
