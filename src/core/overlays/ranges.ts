/** Inclusive slide ranges may arrive in any order; this never reorders the item. */
export function overlayRangesOverlap(
  ranges: ReadonlyArray<{readonly from: number; readonly to: number}>,
): boolean {
  const ordered = [...ranges].sort((left, right) => left.from - right.from);
  return ordered.some((range, index) => {
    const previous = ordered[index - 1];
    return previous !== undefined && previous.to >= range.from;
  });
}

/** An overlay's inclusive slide positions, 1-based in the played order. */
export interface OverlaySpan {
  readonly from: number;
  readonly to: number;
}

/** Earlier starts win; later ranges are clipped or omitted without reordering the input. */
export function normalizeOverlayRanges<T extends OverlaySpan>(
  overlays: readonly T[],
): readonly T[] {
  const kept = new Map<T, T>();
  let end = 0;
  for (const overlay of overlays.toSorted((a, b) => a.from - b.from)) {
    const from = Math.max(overlay.from, end + 1);
    if (from > overlay.to) continue;
    kept.set(overlay, from === overlay.from ? overlay : {...overlay, from});
    end = overlay.to;
  }
  return overlays.flatMap(overlay => {
    const row = kept.get(overlay);
    return row === undefined ? [] : [row];
  });
}

/** The overlay whose inclusive range holds `position` (1-based), if any. */
export function overlayAt<T extends OverlaySpan>(
  overlays: readonly T[],
  position: number,
): T | undefined {
  return overlays.find(
    overlay => overlay.from <= position && overlay.to >= position,
  );
}

/**
 * The range a new overlay gets when it starts on `position`: to the last
 * slide, or to the slide before the next overlay. Undefined when an overlay
 * already holds that slide.
 */
export function newOverlaySpan(
  overlays: readonly OverlaySpan[],
  position: number,
  total: number,
): OverlaySpan | undefined {
  if (position < 1 || position > total) return undefined;
  if (overlayAt(overlays, position) !== undefined) return undefined;
  const following = overlays
    .filter(overlay => overlay.from > position)
    .map(overlay => overlay.from);
  return {from: position, to: Math.min(total, ...following.map(f => f - 1))};
}

/**
 * The range after one end is dragged to `position`: it stays on a slide, never
 * crosses the other end, and stops short of the neighbouring overlays.
 */
export function resizedSpan({
  overlays,
  id,
  edge,
  position,
  total,
}: {
  readonly overlays: ReadonlyArray<OverlaySpan & {readonly id: string}>;
  readonly id: string;
  readonly edge: 'from' | 'to';
  readonly position: number;
  readonly total: number;
}): OverlaySpan | undefined {
  const current = overlays.find(overlay => overlay.id === id);
  if (current === undefined) return undefined;
  const others = overlays.filter(overlay => overlay.id !== id);
  if (edge === 'from') {
    const floor = Math.max(
      1,
      ...others.filter(o => o.to < current.from).map(o => o.to + 1),
    );
    return {
      from: Math.min(current.to, Math.max(floor, position)),
      to: current.to,
    };
  }
  const ceiling = Math.min(
    total,
    ...others.filter(o => o.from > current.to).map(o => o.from - 1),
  );
  return {
    from: current.from,
    to: Math.max(current.from, Math.min(ceiling, position)),
  };
}
