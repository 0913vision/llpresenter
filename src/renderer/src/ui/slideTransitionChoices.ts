import type {SlideTransition} from '@core/schema/slideTransition';

export const SLIDE_EFFECTS = [
  ['none', '없음'],
  ['dissolve', '디졸브'],
  ['push', '밀어내기'],
  ['wipe', '닦아내기'],
] as const;
export const SLIDE_DIRECTIONS = [
  ['left', '←', '왼쪽으로'],
  ['right', '→', '오른쪽으로'],
  ['up', '↑', '위로'],
  ['down', '↓', '아래로'],
] as const;

export const INITIAL_SLIDE_EFFECT: SlideTransition = {kind: 'none', sec: 0.5};

/** Unset effects and omitted left directions show as the same defaults. */
export function sameSlideTransition(
  left: SlideTransition | undefined,
  right: SlideTransition | undefined,
): boolean {
  const a = left ?? INITIAL_SLIDE_EFFECT;
  const b = right ?? INITIAL_SLIDE_EFFECT;
  return (
    a.kind === b.kind &&
    a.sec === b.sec &&
    (a.dir ?? 'left') === (b.dir ?? 'left')
  );
}
