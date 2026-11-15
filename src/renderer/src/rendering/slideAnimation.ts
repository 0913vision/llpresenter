import type {SlideTransition} from '@core/schema/slideTransition';
import {THEME_LIMITS} from '@core/themes/elementRules';

export const WIPE_DURATION_MS_PER_SECOND = 922;
const WIPE_STEPS = 32;
const WIPE_START = 38;
const WIPE_END = 62;

export function wipeMask(direction: string): string {
  const stops = Array.from({length: WIPE_STEPS + 1}, (_, index) => {
    const t = index / WIPE_STEPS;
    const alpha = 1 - t * t * (3 - 2 * t);
    const position = WIPE_START + (WIPE_END - WIPE_START) * t;
    return `rgba(0, 0, 0, ${alpha.toFixed(5)}) ${position}%`;
  });
  return `linear-gradient(to ${direction}, ${stops.join(', ')})`;
}

export interface SlideAnimationFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const TRAVEL = {
  left: ['translateX(100%)', 'translateX(-100%)'],
  right: ['translateX(-100%)', 'translateX(100%)'],
  up: ['translateY(100%)', 'translateY(-100%)'],
  down: ['translateY(-100%)', 'translateY(100%)'],
} as const;
/** PowerPoint's feather begins at the edge and reaches halfway near 35% of the set time. */
const WIPE = {
  left: {
    direction: 'left',
    from: '19.3333333333333% 0%',
    to: '98% 0%',
  },
  right: {
    direction: 'right',
    from: '80.6666666666667% 0%',
    to: '2% 0%',
  },
  up: {
    direction: 'top',
    from: '0% 19.3333333333333%',
    to: '0% 98%',
  },
  down: {
    direction: 'bottom',
    from: '0% 80.6666666666667%',
    to: '0% 2%',
  },
} as const;

/** Owns at most two compositor animations, including interruption and disposal. */
export class SlideAnimation {
  private animations: Animation[] = [];
  private frame: SlideAnimationFrame | undefined;
  private wipe: {
    wrapper: HTMLElement;
    surface: HTMLElement;
    width: string;
    height: string;
    willChange: string;
  } | null = null;

  constructor(private readonly opaque = false) {}

  setFrame(frame: SlideAnimationFrame | undefined): void {
    this.frame = frame;
  }

  play(old: HTMLElement, next: HTMLElement, effect: SlideTransition): void {
    this.cancel();
    old.style.transition = next.style.transition = 'none';
    old.style.opacity =
      effect.kind === 'wipe' || (this.opaque && effect.kind !== 'none')
        ? '1'
        : '0';
    next.style.opacity = '1';
    old.style.zIndex = '0';
    next.style.zIndex = '1';
    if (effect.kind === 'none') return;
    const dir = effect.dir ?? 'left';
    const travel =
      this.frame === undefined
        ? TRAVEL[dir]
        : {
            left: [
              `translateX(${THEME_LIMITS.width}px)`,
              `translateX(-${THEME_LIMITS.width}px)`,
            ],
            right: [
              `translateX(-${THEME_LIMITS.width}px)`,
              `translateX(${THEME_LIMITS.width}px)`,
            ],
            up: [
              `translateY(${THEME_LIMITS.height}px)`,
              `translateY(-${THEME_LIMITS.height}px)`,
            ],
            down: [
              `translateY(-${THEME_LIMITS.height}px)`,
              `translateY(${THEME_LIMITS.height}px)`,
            ],
          }[dir];
    let outgoing: Keyframe[];
    let incoming: Keyframe[];
    switch (effect.kind) {
      case 'dissolve':
        outgoing = [{opacity: 1}, {opacity: this.opaque ? 1 : 0}];
        incoming = [{opacity: 0}, {opacity: 1}];
        break;
      case 'push':
        outgoing = [
          {transform: 'translate(0)', opacity: 1},
          {transform: travel[1], opacity: 1},
        ];
        incoming = [{transform: travel[0]}, {transform: 'translate(0)'}];
        break;
      case 'wipe': {
        const wipe = WIPE[dir];
        const maskImage = wipeMask(wipe.direction);
        const horizontal = dir === 'left' || dir === 'right';
        const from = Number.parseFloat(
          horizontal ? wipe.from : (wipe.from.split(' ')[1] ?? '0'),
        );
        const to = Number.parseFloat(
          horizontal ? wipe.to : (wipe.to.split(' ')[1] ?? '0'),
        );
        const axis = horizontal ? 'X' : 'Y';
        const wrapper = next.ownerDocument.createElement('div');
        Object.assign(wrapper.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: horizontal ? '400%' : '100%',
          height: horizontal ? '100%' : '400%',
          zIndex: '1',
          maskImage,
          maskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          willChange: 'transform',
          pointerEvents: 'none',
        });
        this.wipe = {
          wrapper,
          surface: next,
          width: next.style.width,
          height: next.style.height,
          willChange: next.style.willChange,
        };
        next.parentNode?.insertBefore(wrapper, next);
        wrapper.append(next);
        next.style.width = horizontal ? '25%' : '100%';
        next.style.height = horizontal ? '100%' : '25%';
        next.style.willChange = 'transform';
        const timing = {
          duration: effect.sec * WIPE_DURATION_MS_PER_SECOND,
          easing: 'linear',
          fill: 'both' as const,
        };
        this.animations = [
          next.animate.call(
            wrapper,
            [
              {transform: `translate${axis}(${(-3 * from) / 4}%)`},
              {transform: `translate${axis}(${(-3 * to) / 4}%)`},
            ],
            timing,
          ),
          next.animate(
            [
              {transform: `translate${axis}(${3 * from}%)`},
              {transform: `translate${axis}(${3 * to}%)`},
            ],
            timing,
          ),
        ];
        return;
      }
    }
    const timing = {
      duration: effect.sec * 1000,
      easing: 'linear',
    };
    this.animations = [
      old.animate(outgoing, timing),
      next.animate(incoming, timing),
    ];
  }

  prepare(old: HTMLElement, next: HTMLElement, effect: SlideTransition): void {
    this.play(old, next, effect);
    for (const animation of this.animations) {
      animation.pause();
      animation.currentTime = 0;
    }
  }

  start(): void {
    for (const animation of this.animations) animation.play();
  }

  finished(): Promise<void> | null {
    const completions: Array<Promise<unknown>> = [];
    for (const animation of this.animations) {
      const completion: unknown = Reflect.get(animation, 'finished');
      if (!(completion instanceof Promise)) return null;
      completions.push(completion);
    }
    return completions.length === 0
      ? null
      : Promise.all(completions).then(() => undefined);
  }

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    if (this.wipe !== null) {
      const {wrapper, surface, width, height, willChange} = this.wipe;
      surface.style.width = width;
      surface.style.height = height;
      surface.style.willChange = willChange;
      if (wrapper.parentNode !== null) wrapper.replaceWith(surface);
      else if (surface.parentNode === wrapper) wrapper.removeChild(surface);
      this.wipe = null;
    }
  }
}
