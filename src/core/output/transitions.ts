import {defaultPreferences, type Preferences} from '../schema/preferences';

/** How long a slide and a background take to change; 0 is a cut. */
export interface TransitionTimes {
  readonly slideMs: number;
  readonly backgroundMs: number;
}

type Transition = Preferences['output']['transition']['slide'];

function millisecondsOf({kind, seconds}: Transition): number {
  return kind === 'none' ? 0 : Math.round(seconds * 1000);
}

/** The times of the 슬라이드 전환 and the 배경 전환 of 환경설정. */
export function transitionTimes(
  preferences: Pick<Preferences, 'output'>,
): TransitionTimes {
  const {slide, media} = preferences.output.transition;
  return {slideMs: millisecondsOf(slide), backgroundMs: millisecondsOf(media)};
}

/** What 환경설정 says when nothing is stored: the one place the defaults are read. */
export const DEFAULT_TRANSITION_TIMES: TransitionTimes =
  transitionTimes(defaultPreferences);
