/** How the tiles of a slide grid sit: per row, row height, and top padding. */
export interface GridGeometry {
  readonly tracks: number;
  readonly stride: number;
  readonly inset: number;
}

/** The tile kept in place across a size change, and where it sat. */
export interface ResizeAnchor {
  readonly index: number;
  /** How far below the top of the view the tile's row sat. */
  readonly offset: number;
  /** The scroll position that puts it there again. */
  readonly target: number;
}

/**
 * Where to scroll when the tiles of a grid change size, so the operator keeps
 * looking at the same tile: the one already kept, else the live tile when it
 * is in sight, else the first tile of the first row in sight.
 */
export function resizeAnchor(
  old: GridGeometry & {readonly anchor?: ResizeAnchor | undefined},
  next: GridGeometry,
  {
    top,
    height,
    live,
    count,
    rowGap,
  }: {
    /** The scroll position now. */
    readonly top: number;
    /** The height of the view. */
    readonly height: number;
    readonly live: number | null;
    readonly count: number;
    readonly rowGap: number;
  },
): ResizeAnchor {
  const liveTop =
    live === null
      ? -Infinity
      : old.inset + Math.floor(live / old.tracks) * old.stride;
  const liveVisible =
    live !== null &&
    live < count &&
    liveTop + old.stride > top &&
    liveTop < top + height;
  const index =
    old.anchor && old.anchor.index < count
      ? old.anchor.index
      : liveVisible
        ? live
        : Math.min(
            count - 1,
            Math.max(0, Math.ceil((top - old.inset) / old.stride)) * old.tracks,
          );
  const oldTop = old.inset + Math.floor(index / old.tracks) * old.stride;
  const offset = old.anchor?.offset ?? oldTop - top;
  const newTop = next.inset + Math.floor(index / next.tracks) * next.stride;
  const rows = Math.ceil(count / next.tracks);
  const total = Math.max(0, rows * next.stride - rowGap) + next.inset * 2;
  const target = Math.max(0, Math.min(total - height, newTop - offset));
  return {index, offset, target};
}
