import type {SlideTransition} from '@core/schema/slideTransition';
import {THEME_LIMITS} from '@core/themes/elementRules';

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
const WIPE = {
  left: {direction: 'left', size: '285% 100%', from: '0% 0%', to: '100% 0%'},
  right: {direction: 'right', size: '285% 100%', from: '100% 0%', to: '0% 0%'},
  up: {direction: 'top', size: '100% 285%', from: '0% 0%', to: '0% 100%'},
  down: {direction: 'bottom', size: '100% 285%', from: '0% 100%', to: '0% 0%'},
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
    old.style.opacity = '0';
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
        const maskImage = `linear-gradient(to ${wipe.direction}, black 0%, black 35.087719%, transparent 64.912281%, transparent 100%)`;
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
    const timing = {duration: effect.sec * 1000, easing: 'linear'};
    this.animations = [
      old.animate(outgoing, timing),
      next.animate(incoming, timing),
    ];
  }

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }
}
