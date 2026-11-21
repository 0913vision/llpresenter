import type {Song} from '../schema/song';

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
/** Placement belongs to the song's choice, not an item's independent override. */
export function songBackgroundFrame({
  song,
  item,
  backgroundNone,
}: {
  readonly song: {
    readonly background?: string | undefined;
    readonly backgroundFrame?: Song['backgroundFrame'];
  };
  readonly item?: string | undefined;
  readonly backgroundNone?: boolean | undefined;
}): Song['backgroundFrame'] {
  return backgroundNone === true ||
    item !== undefined ||
    song.background === undefined
    ? undefined
    : song.backgroundFrame;
}
