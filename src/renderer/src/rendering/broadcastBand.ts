import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import {emptySongSlideText} from '@core/presentation/emptySongSlide';

/**
 * Resolves the broadcast-only Bible flow and empty-song title.
 * @param slide - The current slide, if any.
 * @param item - Its live theme item, if any.
 * @returns Whether Bible flow applies and the title for an empty song slide.
 */
export function broadcastIntent(
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
): {bible: boolean; songTitle: string | undefined} {
  const bible = (item?.kind ?? slide?.kind) === 'bible';
  const songTitle = emptySongSlideText(slide, item, 'title')?.replace(
    /\s+/gu,
    ' ',
  );
  return {bible, songTitle};
}
