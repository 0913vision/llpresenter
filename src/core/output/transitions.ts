import type {SlideTransition} from '../schema/slideTransition';
import type {SlideLayer} from '../live/state';

/** A slide without an assigned effect cuts. */
export function reverseSlideTransition(
  effect: SlideTransition | null,
): SlideTransition {
  if (effect === null) return {kind: 'none', sec: 0.5};
  if (effect.kind !== 'push' && effect.kind !== 'wipe') return effect;
  const opposite = {
    left: 'right',
    right: 'left',
    up: 'down',
    down: 'up',
  } as const;
  return {...effect, dir: opposite[effect.dir ?? 'left']};
}

export function slideTransitionFor(
  slide: Pick<SlideLayer, 'itemId' | 'transition' | 'reverseTransition'> | null,
): SlideTransition {
  return slide?.reverseTransition !== undefined
    ? reverseSlideTransition(slide.reverseTransition)
    : (slide?.transition ?? {kind: 'none', sec: 0.5});
}
