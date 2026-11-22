import type {SlideTransitionDefaults} from '../schema/preferences';
import {createSlideId} from '../schema/ids';
import type {Slide} from '../schema/slide';
import type {SlideTransition} from '../schema/slideTransition';
import type {SlidePurpose} from '../schema/theme';
import type {Themes} from '../schema/themes';
import {themeFor} from '../theme/themes';

/** What every new slide is made with: the themes and the transitions. */
export interface SlideMaking {
  readonly themes: Pick<Themes, 'themes' | 'defaults'> | null | undefined;
  readonly transitions: SlideTransitionDefaults;
}

const TRANSITION_OF = {
  songTitle: 'songTitle',
  lyrics: 'song',
  sermonTitle: 'sermonTitle',
  scripture: 'bible',
  notice: 'ad',
  title: 'section',
  creed: 'creed',
  preparation: 'blank',
  standby: 'blank',
  blank: 'blank',
  picture: 'blank',
  media: 'blank',
} as const satisfies Record<SlidePurpose, keyof SlideTransitionDefaults>;

/** The transition a new slide for a purpose comes in with. */
export function transitionFor(
  {transitions}: Pick<SlideMaking, 'transitions'>,
  purpose: SlidePurpose,
): SlideTransition {
  return transitions[TRANSITION_OF[purpose]];
}

/** A new slide for a purpose, in the theme the operator uses for it. */
export function makeSlide(
  making: SlideMaking,
  purpose: SlidePurpose,
  slide: Partial<Omit<Slide, 'id'>> = {},
): Slide {
  return {
    id: createSlideId(crypto.randomUUID()),
    theme: themeFor(making.themes, purpose).id,
    texts: {},
    transition: transitionFor(making, purpose),
    ...slide,
  };
}

/** A copy of a slide with its own identity, and no hot key taken with it. */
export function copySlide(slide: Slide): Slide {
  const {hotKey: _hotKey, ...copied} = slide;
  return {...copied, id: createSlideId(crypto.randomUUID())};
}
