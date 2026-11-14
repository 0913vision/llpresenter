import {defaultPreferences, type Preferences} from '../schema/preferences';
import type {SlideTransition} from '../schema/slideTransition';
import type {SlideLayer} from '../live/state';

/** How long a slide and a background take to change; 0 is a cut. */
export interface TransitionTimes {
  readonly slideMs: number;
  readonly backgroundMs: number;
}

/** Slide and background change together, using only the incoming slide. */
export function transitionTimes(
  _preferences: Pick<Preferences, 'output'>,
  slide: SlideTransition = {kind: 'none', sec: 0.5},
): TransitionTimes {
  const ms = slide.kind === 'none' ? 0 : Math.round(slide.sec * 1000);
  return {slideMs: ms, backgroundMs: ms};
}

/** A slide without an assigned effect cuts, independently of old settings. */
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
  _defaults: Preferences['output']['transition'],
  _previousItemId: string | null,
  slide:
    | (Pick<SlideLayer, 'itemId' | 'transition' | 'reverseTransition'> & {
        readonly themeTransition?: SlideTransition;
      })
    | null,
): SlideTransition {
  return slide?.reverseTransition !== undefined
    ? reverseSlideTransition(slide.reverseTransition)
    : (slide?.transition ?? {kind: 'none', sec: 0.5});
}

/** What 환경설정 says when nothing is stored: the one place the defaults are read. */
export const DEFAULT_TRANSITION_TIMES: TransitionTimes =
  transitionTimes(defaultPreferences);
