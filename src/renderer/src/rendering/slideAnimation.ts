import type {SlideTransition} from '@core/schema/slideTransition';
import {THEME_LIMITS} from '@core/themes/elementRules';

export const WIPE_DURATION_MS_PER_SECOND = 954;
const WIPE_STEPS = 32;
const WIPE_START = 34;
const WIPE_END = 66;

function wipeMask(direction: string): string {
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
/** PowerPoint's feather starts outside and sweeps in 95.4% of the set time. */
const WIPE = {
  left: {
    direction: 'left',
    size: '300% 100%',
    from: '-8% 0%',
    to: '95% 0%',
  },
  right: {
    direction: 'right',
    size: '300% 100%',
    from: '108% 0%',
    to: '5% 0%',
  },
  up: {
    direction: 'top',
    size: '100% 300%',
    from: '0% -8%',
    to: '0% 95%',
  },
  down: {
    direction: 'bottom',
    size: '100% 300%',
    from: '0% 108%',
    to: '0% 5%',
  },
} as const;

/** Owns at most two compositor animations, including interruption and disposal. */
export class SlideAnimation {
  private animations: Animation[] = [];
  private frame: SlideAnimationFrame | undefined;

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
        outgoing = [{opacity: 1}, {opacity: 1}];
        incoming = [
          {
            maskImage,
            maskSize: wipe.size,
            maskPosition: wipe.from,
            maskRepeat: 'no-repeat',
          },
          {
            maskImage,
            maskSize: wipe.size,
            maskPosition: wipe.to,
            maskRepeat: 'no-repeat',
          },
        ];
        break;
      }
    }
    const timing = {
      duration:
        effect.sec *
        (effect.kind === 'wipe' ? WIPE_DURATION_MS_PER_SECOND : 1000),
      easing: 'linear',
    };
    this.animations =
      effect.kind === 'wipe'
        ? [next.animate(incoming, timing)]
        : [old.animate(outgoing, timing), next.animate(incoming, timing)];
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
  }
}
