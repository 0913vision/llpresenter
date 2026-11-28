import type {Slide} from '@core/schema/slides/slide';

/** Whether a slide ends with the ` (계속)` marker: a part of a verse that goes on in the next slide. */
export function continues(
  slide: Pick<Slide, 'continued'> | undefined,
): boolean {
  return slide?.continued === true;
}

/**
 * The slide with its ` (계속)` marker on or off; the same slide when it is so
 * already. Only the marker changes: the verse stays cut where it was.
 */
export function withContinued(slide: Slide, on: boolean): Slide {
  if (continues(slide) === on) return slide;
  const {continued: _continued, ...kept} = slide;
  return on ? {...kept, continued: true} : kept;
}
