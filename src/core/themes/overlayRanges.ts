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
  const remapped = overlays.map(overlay => ({
    overlay,
    span: remapSpan(overlay, moved),
  }));
  const ordered = remapped.toSorted((a, b) => a.span.from - b.span.from);
  const kept = new Map<T, OverlaySpan>();
  let end = 0;
  for (const {overlay, span} of ordered) {
    const from = Math.max(span.from, end + 1);
    if (from > span.to) continue;
    kept.set(overlay, {from, to: span.to});
    end = span.to;
  }
  return overlays.flatMap(overlay => {
    const span = kept.get(overlay);
    if (span === undefined) return [];
    return [
      span.from === overlay.from && span.to === overlay.to
        ? overlay
        : {...overlay, ...span},
    ];
  });
}
