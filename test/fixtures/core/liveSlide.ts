import type {SlideLayer} from '@core/live/state';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {slideId} from './slides';

/** What a slide of lyrics on output holds beside its place. */
export function shownText(
  text: string | readonly string[],
): Omit<SlideLayer, 'itemId' | 'position'> {
  return {
    slideId: slideId(1),
    theme: BUILT_IN_THEME_IDS.lyrics,
    texts: {가사: typeof text === 'string' ? text : text.join('\n')},
    auto: {},
    next: null,
  };
}
