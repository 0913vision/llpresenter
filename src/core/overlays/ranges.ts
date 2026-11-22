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

/**
 * Where each position of `before` sits in `after`, matching the nth
 * occurrence of a slide number to the nth occurrence in `after`.
 */
function positionsAfter(
  before: readonly number[],
  after: readonly number[],
): ReadonlyArray<number | undefined> {
  const places = new Map<number, number[]>();
  after.forEach((slide, index) => {
    const list = places.get(slide) ?? [];
    list.push(index + 1);
    places.set(slide, list);
  });
  const seen = new Map<number, number>();
  return before.map(slide => {
    const nth = seen.get(slide) ?? 0;
    seen.set(slide, nth + 1);
    return places.get(slide)?.[nth];
  });
}

function remapSpan(
  span: OverlaySpan,
  moved: ReadonlyArray<number | undefined>,
): OverlaySpan {
  const survivors: number[] = [];
  for (let at = span.from; at <= span.to; at++) {
    const place = moved[at - 1];
    if (place !== undefined) survivors.push(place);
  }
  // NOTE(0913vision): A range with no surviving slide is kept as it was, so a
  // later edit can bring its slides back; readers clamp it to the played length.
  const first = survivors.at(0);
  const last = survivors.at(-1);
  if (first === undefined || last === undefined) return span;
  return {from: Math.min(first, last), to: Math.max(first, last)};
}

/**
 * Moves each overlay's range with the slides it starts and ends on when the
 * played order changes from `before` to `after` (slide numbers in played
 * order). A removed end slide hands the end to the slide before it; a range
 * whose slides are all gone is kept as it was. A range that would overlap the
 * one before it starts after it, and is dropped when nothing is left of it.
 */
export function remapOverlayRanges<T extends OverlaySpan>(
  overlays: readonly T[],
  before: readonly number[],
  after: readonly number[],
): readonly T[] {
  const moved = positionsAfter(before, after);
  return normalizeOverlayRanges(
    overlays.map(overlay => {
      const span = remapSpan(overlay, moved);
      return span.from === overlay.from && span.to === overlay.to
        ? overlay
        : {...overlay, ...span};
    }),
  );
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

/** The 1-based slide whose centre is nearest `x`, or undefined without slides. */
export function nearestSlide(
  x: number,
  centres: readonly number[],
): number | undefined {
  let best: number | undefined;
  let distance = Infinity;
  centres.forEach((centre, index) => {
    const gap = Math.abs(centre - x);
    if (gap < distance) {
      distance = gap;
      best = index + 1;
    }
  });
  return best;
}

/** One row of an overlay's clip: columns are 0-based and inclusive. */
export interface ClipSegment {
  readonly row: number;
  readonly firstColumn: number;
  readonly lastColumn: number;
  /** The range began on an earlier row, so the clip opens with ›. */
  readonly continuesBefore: boolean;
  /** The range goes on to the next row, so the clip ends with ›. */
  readonly continuesAfter: boolean;
}

/** Splits a range over rows of `columns` slides, as the clip is drawn. */
export function clipSegments(
  span: OverlaySpan,
  columns: number,
): readonly ClipSegment[] {
  if (columns < 1 || span.from < 1 || span.to < span.from) return [];
  const first = span.from - 1;
  const last = span.to - 1;
  const firstRow = Math.floor(first / columns);
  const lastRow = Math.floor(last / columns);
  const segments: ClipSegment[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    segments.push({
      row,
      firstColumn: row === firstRow ? first % columns : 0,
      lastColumn: row === lastRow ? last % columns : columns - 1,
      continuesBefore: row > firstRow,
      continuesAfter: row < lastRow,
    });
  }
  return segments;
}
