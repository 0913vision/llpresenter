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
/** An explicit absence wins, then the item override, then the song default. */
export function songItemBackground({
  backgroundNone,
  item,
  song,
}: {
  readonly backgroundNone?: boolean | undefined;
  readonly item?: string | undefined;
  readonly song?: string | undefined;
}): string | undefined {
  return backgroundNone === true ? undefined : (item ?? song);
}
