import type {SlideTransition} from '@core/schema/slides/slideTransition';
import type {SlideLayer} from '@core/schema/live/live';

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

/**
 * The effect that brings the slide in: its `reverseTransition` turned around
 * when it has one, else its own `transition`, else a cut.
 */
export function slideTransitionFor(
  slide: Pick<SlideLayer, 'itemId' | 'transition' | 'reverseTransition'> | null,
): SlideTransition {
  return slide?.reverseTransition !== undefined
    ? reverseSlideTransition(slide.reverseTransition)
    : (slide?.transition ?? {kind: 'none', sec: 0.5});
}
