/** A chosen song background covers every slide; pictures remain when it is cleared. */
export function songSlideBackground(
  picture: string | undefined,
  background: string | undefined,
): string | undefined {
  return background ?? songSlidePicture(picture, background);
}

/** Keep an imported slide picture only while no song background is selected. */
export function songSlidePicture(
  picture: string | undefined,
  background: string | undefined,
): string | undefined {
  return background === undefined ? picture : undefined;
}
