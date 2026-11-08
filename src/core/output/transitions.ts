import {defaultPreferences, type Preferences} from '../schema/preferences';
import type {SlideTransition} from '../schema/slideTransition';
import type {SlideLayer} from '../live/state';

/** How long a slide and a background take to change; 0 is a cut. */
export interface TransitionTimes {
  readonly slideMs: number;
  readonly backgroundMs: number;
}

function millisecondsOf({
  kind,
  seconds,
}: Preferences['output']['transition']['media']): number {
  return kind === 'none' ? 0 : Math.round(seconds * 1000);
}

/** The times of the 슬라이드 전환 and the 배경 전환 of 환경설정. */
export function transitionTimes(
  preferences: Pick<Preferences, 'output'>,
  slide = preferences.output.transition.between,
): TransitionTimes {
  const {media} = preferences.output.transition;
  return {
    slideMs: slide.kind === 'none' ? 0 : Math.round(slide.sec * 1000),
    backgroundMs: millisecondsOf(media),
  };
}

export function slideTransitionFor(
  defaults: Preferences['output']['transition'],
  previousItemId: string | null,
  slide: Pick<SlideLayer, 'itemId' | 'transition'> | null,
): SlideTransition {
  return (
    slide?.transition ??
    (slide !== null && slide.itemId === previousItemId
      ? defaults.within
      : defaults.between)
  );
}

/** What 환경설정 says when nothing is stored: the one place the defaults are read. */
export const DEFAULT_TRANSITION_TIMES: TransitionTimes =
  transitionTimes(defaultPreferences);
