import type {Slide} from '@core/schema/slides/slide';

/** Whether a slide shows nothing of the next slide on 무대: its own choice. */
export function hidesNext(slide: Pick<Slide, 'hideNext'> | undefined): boolean {
  return slide?.hideNext === true;
}

/** A slide that shows the next one on 무대, or not; the same slide when it does so already. */
export function withHideNext(slide: Slide, hide: boolean): Slide {
  if (hidesNext(slide) === hide) return slide;
  const {hideNext: _hide, ...kept} = slide;
  return hide ? {...kept, hideNext: true} : kept;
}
