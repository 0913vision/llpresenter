import type {SlideTransition} from '@core/schema/slideTransition';
import {THEME_LIMITS} from '@core/themes/elementRules';

export const WIPE_DURATION_MS_PER_SECOND = 954;

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
/** PowerPoint's feather starts outside and sweeps a 0.8-screen ramp in 95.4%. */
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
        const maskImage = `linear-gradient(to ${wipe.direction}, black 0%, black 36.666667%, transparent 63.333333%, transparent 100%)`;
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

  /** Keep a push's old picture in place until the incoming picture is ready. */
  holdOutgoing(): void {
    this.animations[0]?.pause();
  }

  /** Bring the outgoing push up to the incoming animation's current time. */
  resumeOutgoing(): void {
    const [outgoing, incoming] = this.animations;
    if (outgoing === undefined || incoming === undefined) return;
    if (incoming.playState === 'finished') {
      outgoing.finish();
      return;
    }
    outgoing.currentTime = incoming.currentTime;
    outgoing.play();
  }

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }
}
