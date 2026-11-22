import type {PowerPointSource} from '@core/schema/powerpointImport';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {powerpointBackgroundIndex} from '@core/songs/powerpointBackgroundIndex';
import type {SlideInput} from '@renderer/rendering/slideStillSpec';

/** The slides of an import as they will be drawn after it. */
export function powerPointPictures(
  slides: PowerPointSource['slides'],
  images: ReadonlyMap<string, string>,
  options: Omit<SlideInput, 'slide' | 'background'> & {
    readonly selection?: {readonly start: number; readonly end: number};
  },
): readonly SlideInput[] {
  const {selection = {start: 0, end: slides.length - 1}, ...appearance} =
    options;
  const selected = slides.slice(selection.start, selection.end + 1);
  const selectedSlides = powerpointSlides(selected);
  const winner = powerpointBackgroundIndex(selected);
  const defaultKey =
    winner === undefined ? undefined : selected[winner]?.background;
  const defaultBackground = defaultKey ? images.get(defaultKey) : undefined;
  return powerpointSlides(slides).map((slide, index) => {
    const selectedSlide =
      index >= selection.start && index <= selection.end
        ? (selectedSlides[index - selection.start] ?? slide)
        : slide;
    const backgroundKey = slides[index]?.background;
    return {
      ...appearance,
      slide: {
        itemId: 'powerpoint-import',
        position: index,
        label: null,
        ...selectedSlide,
      },
      background:
        (backgroundKey ? images.get(backgroundKey) : undefined) ??
        defaultBackground,
    };
  });
}
