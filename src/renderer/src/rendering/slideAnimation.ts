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
const EDGE = {
  left: ['inset(0 0 0 100%)', 'inset(0 100% 0 0)'],
  right: ['inset(0 100% 0 0)', 'inset(0 0 0 100%)'],
  up: ['inset(100% 0 0 0)', 'inset(0 0 100% 0)'],
  down: ['inset(0 0 100% 0)', 'inset(100% 0 0 0)'],
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
    const edge = this.frame === undefined ? EDGE[dir] : this.screenEdge(dir);
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
      case 'wipe':
        outgoing = [
          {clipPath: edge[2] ?? 'inset(0)', opacity: 1},
          {clipPath: edge[1], opacity: 1},
        ];
        incoming = [{clipPath: edge[0]}, {clipPath: edge[3] ?? 'inset(0)'}];
        break;
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

  private screenEdge(
    dir: NonNullable<SlideTransition['dir']>,
  ): readonly [string, string, string, string] {
    const {x, y, w, h} = this.frame ?? {
      x: 0,
      y: 0,
      w: THEME_LIMITS.width,
      h: THEME_LIMITS.height,
    };
    const {width, height} = THEME_LIMITS;
    const inset = ([top, right, bottom, left]: readonly [
      number,
      number,
      number,
      number,
    ]): string => `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    const full = inset([-y, x + w - width, y + h - height, -x]);
    switch (dir) {
      case 'left':
        return [
          inset([-y, x + w - width, y + h - height, width - x]),
          inset([-y, x + w, y + h - height, -x]),
          full,
          full,
        ];
      case 'right':
        return [
          inset([-y, x + w, y + h - height, -x]),
          inset([-y, x + w - width, y + h - height, width - x]),
          full,
          full,
        ];
      case 'up':
        return [
          inset([height - y, x + w - width, y + h - height, -x]),
          inset([-y, x + w - width, y + h, -x]),
          full,
          full,
        ];
      case 'down':
        return [
          inset([-y, x + w - width, y + h, -x]),
          inset([height - y, x + w - width, y + h - height, -x]),
          full,
          full,
        ];
    }
  }
}
