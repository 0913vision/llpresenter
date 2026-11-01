import type {ItemOverlay} from '../schema/itemOverlays';

export interface ItemOverlayRow {
  readonly overlay: ItemOverlay;
  readonly start: boolean;
  readonly end: boolean;
}

/** Maps a zero-based slide row to its inclusive overlay range and edges. */
export function itemOverlayRow(
  overlays: readonly ItemOverlay[],
  index: number,
): ItemOverlayRow | undefined {
  const position = index + 1;
  const overlay = overlays.find(
    range => range.from <= position && range.to >= position,
  );
  return overlay === undefined
    ? undefined
    : {overlay, start: overlay.from === position, end: overlay.to === position};
}
