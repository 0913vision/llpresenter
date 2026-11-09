const NAME_LINE_PX = 20;
const ASPECT_RATIO = 16 / 9;

/** Fits automatic media tiles and their names inside the bounded bin. */
export function mediaGridLayout({
  columns: requested,
  fitHeight,
  width,
  height,
  xGap,
  yGap,
  nameGap,
  inset,
}: {
  readonly columns: number;
  readonly fitHeight: boolean;
  readonly width: number;
  readonly height: number;
  readonly xGap: number;
  readonly yGap: number;
  readonly nameGap: number;
  readonly inset: number;
}) {
  const pictureHeight = height - inset * 2 - nameGap - NAME_LINE_PX;
  const columns =
    fitHeight && width > 0 && pictureHeight > 0
      ? Math.max(
          requested,
          Math.ceil((width + xGap) / (pictureHeight * ASPECT_RATIO + xGap)),
        )
      : requested;
  const tileWidth = width > 0 ? (width - (columns - 1) * xGap) / columns : 0;
  return {
    columns,
    stride:
      tileWidth > 0
        ? tileWidth / ASPECT_RATIO + nameGap + NAME_LINE_PX + yGap
        : 1,
  };
}
