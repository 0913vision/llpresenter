import type {PowerPointSource} from '@core/schema/powerpointImport';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {powerpointBackgroundIndex} from '@core/songs/powerpointBackgroundIndex';
import {pictureSpec} from '@renderer/rendering/pictureSpec';
import type {SlideInput} from '@renderer/rendering/outputSlideSpec';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';

/** Projects an import into the same picture specifications as output previews. */
export function powerPointPictureSpecs(
  slides: PowerPointSource['slides'],
  images: ReadonlyMap<string, string>,
  options: Omit<SlideInput, 'slide' | 'background'> & {
    readonly selection?: {
      readonly start: number;
      readonly end: number;
      readonly indices?: readonly number[];
    };
  },
): readonly PictureSpec[] {
  const {selection = {start: 0, end: slides.length - 1}, ...appearance} =
    options;
  const indices =
    selection.indices ??
    slides.map((_, index) => index).slice(selection.start, selection.end + 1);
  const selected = indices.flatMap(index => {
    const slide = slides[index];
    return slide === undefined ? [] : [slide];
  });
  const selectionIndex = new Map(
    indices.map((index, position) => [index, position]),
  );
  const selectedSlides = powerpointSlides(selected);
  const winner = powerpointBackgroundIndex(selected);
  const defaultKey =
    winner === undefined ? undefined : selected[winner]?.background;
  const defaultBackground = defaultKey ? images.get(defaultKey) : undefined;
  return powerpointSlides(slides).map((slide, index) => {
    const position = selectionIndex.get(index);
    const selectedSlide =
      position === undefined ? slide : (selectedSlides[position] ?? slide);
    const backgroundKey = slides[index]?.background;
    const background =
      (backgroundKey ? images.get(backgroundKey) : undefined) ??
      defaultBackground;
    return pictureSpec({
      kind: 'slide',
      input: {
        ...appearance,
        slide: {
          itemId: 'powerpoint-import',
          position: index,
          label: null,
          ...selectedSlide,
        },
        background,
      },
    }).spec;
  });
}
