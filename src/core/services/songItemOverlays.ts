import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
import type {ItemOverlay, SongItemOverlay} from '../schema/itemOverlays';
import {normalizeOverlayRanges} from '../themes/overlayRanges';

/** Resolves stable song endpoints into positions for the output and range controls. */
export function projectedItemOverlays(
  item: ServiceItem | null,
): readonly ItemOverlay[] {
  if (item === null) return [];
  if (!isItemOfKind(item, 'song')) return item.overlays ?? [];
  const indices = new Map(
    item.slides.map((slide, index) => [slide.id, index + 1]),
  );
  return normalizeOverlayRanges(
    (item.overlays ?? []).flatMap(overlay => {
      const from = indices.get(overlay.from);
      const to = indices.get(overlay.to);
      return from === undefined || to === undefined
        ? []
        : [{...overlay, from: Math.min(from, to), to: Math.max(from, to)}];
    }),
  );
}

export function storedSongOverlays(
  item: ServiceItemOf<'song'>,
  rows: readonly ItemOverlay[],
): readonly SongItemOverlay[] {
  return rows.flatMap(row => {
    const from = item.slides[row.from - 1]?.id;
    const to = item.slides[row.to - 1]?.id;
    return from === undefined || to === undefined ? [] : [{...row, from, to}];
  });
}
