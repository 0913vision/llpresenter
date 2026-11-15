import type {SlideListPoint} from '@core/songs/slideListSelection';

export function selectedSlideAnchor(
  surface: HTMLElement | null,
  focus: SlideListPoint<string> | null,
): HTMLElement | null {
  if (surface === null || focus?.kind !== 'slide') return surface;
  return (
    [...surface.querySelectorAll<HTMLElement>('[data-song-slide]')].find(
      slide => slide.dataset['songSlide'] === focus.id,
    ) ?? surface
  );
}
