import type {SlideTransition} from '@core/schema/slideTransition';
import {THEME_LIMITS} from '@core/themes/elementRules';

export const WIPE_DURATION_MS_PER_SECOND = 1000;
const WIPE_STEPS = 32;
const WIPE_START = 37.875;
const WIPE_END = 62.125;

export function wipeMask(direction: string): string {
  const stops = Array.from({length: WIPE_STEPS + 1}, (_, index) => {
    const t = index / WIPE_STEPS;
    const alpha = 1 - t * t * (3 - 2 * t);
    const position = Number(
      (WIPE_START + (WIPE_END - WIPE_START) * t).toFixed(3),
    );
    return `rgba(0,0,0,${alpha.toFixed(5).replace(/^0/, '')}) ${position}%`;
  });
  return `linear-gradient(to ${direction},${stops.join(',')})`;
}

let handoff: ((effect: SlideTransition) => void) | null = null;

/**
 * In an output shown through a presenter, slide transitions are blended there
 * at the monitor's own refresh; the page hands each one over and cuts.
 */
export function handSlideTransitionsTo(
  target: ((effect: SlideTransition) => void) | null,
): void {
  handoff = target;
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
/** PowerPoint's feather traverses 2.02 screen widths over the set time. */
const WIPE = {
  left: {
    direction: 'left',
    from: '20% 0%',
    to: '87.3333333333333% 0%',
  },
  right: {
    direction: 'right',
    from: '80% 0%',
    to: '12.6666666666667% 0%',
  },
  up: {
    direction: 'top',
    from: '0% 20%',
    to: '0% 87.3333333333333%',
  },
  down: {
    direction: 'bottom',
    from: '0% 80%',
    to: '0% 12.6666666666667%',
  },
} as const;

/** Owns at most two compositor animations, including interruption and disposal. */
export class SlideAnimation {
  private animations: Animation[] = [];
  private frame: SlideAnimationFrame | undefined;
  private handedOff: {
    old: HTMLElement;
    next: HTMLElement;
    effect: SlideTransition;
  } | null = null;
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

  play(old: HTMLElement, next: HTMLElement, requested: SlideTransition): void {
    this.cancel();
    let effect = requested;
    if (handoff !== null && requested.kind !== 'none') {
      handoff(requested);
      effect = {kind: 'none', sec: requested.sec};
    }
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
    if (handoff !== null && effect.kind !== 'none') {
      this.cancel();
      old.style.opacity = '1';
      next.style.opacity = '0';
      this.handedOff = {old, next, effect};
      return;
    }
    this.play(old, next, effect);
    for (const animation of this.animations) {
      animation.pause();
      animation.currentTime = 0;
    }
  }

  start(): void {
    const handed = this.handedOff;
    if (handed !== null) {
      this.handedOff = null;
      this.play(handed.old, handed.next, handed.effect);
      return;
    }
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
    this.handedOff = null;
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
