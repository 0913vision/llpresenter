import type {SlideTransition} from '@core/schema/slideTransition';

type Direction = NonNullable<SlideTransition['dir']>;

// NOTE(0913vision): The wipe's edge is a ramp 0.97 of the screen wide. It starts
// at the far side with nothing revealed and ends with everything revealed, so a
// wipe changes the picture for exactly the time it is set to. The presenter's
// shader draws the same ramp.
const RAMP = 0.97;
const STEPS = 32;
const MASK_SCREENS = 4;

const TRAVEL: Readonly<Record<Direction, readonly [string, string]>> = {
  left: ['translateX(100%)', 'translateX(-100%)'],
  right: ['translateX(-100%)', 'translateX(100%)'],
  up: ['translateY(100%)', 'translateY(-100%)'],
  down: ['translateY(-100%)', 'translateY(100%)'],
};

/** Opaque on the side the new slide comes from, after a ramp in the middle. */
function wipeMask(direction: Direction): string {
  const from = 50 - (RAMP / MASK_SCREENS / 2) * 100;
  const length = (RAMP / MASK_SCREENS) * 100;
  const stops = Array.from({length: STEPS + 1}, (_, index) => {
    const t = index / STEPS;
    const alpha = t * t * (3 - 2 * t);
    return `rgba(0,0,0,${alpha.toFixed(5)}) ${(from + length * t).toFixed(3)}%`;
  });
  const to = {left: 'right', right: 'left', up: 'bottom', down: 'top'};
  return `linear-gradient(to ${to[direction]},${stops.join(',')})`;
}

/** The transition of one slide change on a page; it runs once. */
export class SlideAnimation {
  private animations: Animation[] = [];
  private unwrap: (() => void) | null = null;

  play(old: HTMLElement, next: HTMLElement, effect: SlideTransition): void {
    old.style.zIndex = '0';
    next.style.zIndex = '1';
    if (effect.kind === 'none') return;
    const direction = effect.dir ?? 'left';
    const timing: KeyframeAnimationOptions = {
      duration: effect.sec * 1000,
      easing: 'linear',
      fill: 'both',
    };
    switch (effect.kind) {
      case 'dissolve':
        this.animations = [
          next.animate([{opacity: 0}, {opacity: 1}], timing),
        ];
        return;
      case 'push': {
        const [from, to] = TRAVEL[direction];
        this.animations = [
          old.animate([{transform: 'none'}, {transform: to}], timing),
          next.animate([{transform: from}, {transform: 'none'}], timing),
        ];
        return;
      }
      case 'wipe':
        this.wipe(next, direction, timing);
    }
  }

  async finished(): Promise<void> {
    await Promise.all(this.animations.map(animation => animation.finished));
  }

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.unwrap?.();
    this.unwrap = null;
  }

  /** Moves a mask across the new slide while the slide itself stays in place. */
  private wipe(
    next: HTMLElement,
    direction: Direction,
    timing: KeyframeAnimationOptions,
  ): void {
    const horizontal = direction === 'left' || direction === 'right';
    const axis = horizontal ? 'X' : 'Y';
    const backward = direction === 'right' || direction === 'down';
    const wrapper = next.ownerDocument.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: horizontal ? `${MASK_SCREENS * 100}%` : '100%',
      height: horizontal ? '100%' : `${MASK_SCREENS * 100}%`,
      zIndex: '1',
      maskImage: wipeMask(direction),
      willChange: 'transform',
      pointerEvents: 'none',
    });
    const {width, height, willChange} = next.style;
    next.parentNode?.insertBefore(wrapper, next);
    wrapper.append(next);
    next.style.width = horizontal ? `${100 / MASK_SCREENS}%` : '100%';
    next.style.height = horizontal ? '100%' : `${100 / MASK_SCREENS}%`;
    next.style.willChange = 'transform';
    this.unwrap = () => {
      Object.assign(next.style, {width, height, willChange});
      wrapper.replaceWith(next);
    };
    // NOTE(0913vision): The ramp starts this many screens into the mask. It
    // travels from just past the far side of the screen to just past the near one.
    const ramp = MASK_SCREENS / 2 - RAMP / 2;
    const shifts = [ramp - 1, ramp + RAMP].map(value =>
      backward ? MASK_SCREENS - 1 - value : value,
    );
    this.animations = [
      wrapper.animate(
        shifts.map(value => ({
          transform: `translate${axis}(${(-value / MASK_SCREENS) * 100}%)`,
        })),
        timing,
      ),
      next.animate(
        shifts.map(value => ({
          transform: `translate${axis}(${value * 100}%)`,
        })),
        timing,
      ),
    ];
  }
}
