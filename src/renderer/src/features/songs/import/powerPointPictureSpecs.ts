import type {PowerPointSource} from '@core/schema/powerpointImport';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {powerpointBackgroundIndex} from '@core/songs/powerpointBackgroundIndex';
import {
  outputSlideSpec,
  type SlideInput,
} from '@renderer/rendering/OutputSlidePicture';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';

/** Projects an import into the same picture specifications as output previews. */
export function powerPointPictureSpecs(
  slides: PowerPointSource['slides'],
  images: ReadonlyMap<string, string>,
  options: Omit<SlideInput, 'slide' | 'background'> & {
    readonly selection?: {readonly start: number; readonly end: number};
  },
): readonly PictureSpec[] {
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
    const background =
      (backgroundKey ? images.get(backgroundKey) : undefined) ??
      defaultBackground;
    return outputSlideSpec({
      ...appearance,
      slide: {
        itemId: 'powerpoint-import',
        position: index,
        label: null,
        ...selectedSlide,
      },
      background,
    });
  });
}
