/** Snaps a section insertion to a header boundary, leaving unheaded rows alone. */
export function sectionBoundaryIndex<T>(
  rows: readonly T[],
  index: number,
  isHeader: (row: T) => boolean,
): number {
  if (index < 0 || index >= rows.length) return index;
  for (let previous = index; previous >= 0; previous--) {
    const row = rows[previous];
    if (row !== undefined && isHeader(row)) return previous;
  }
  const firstHeader = rows.findIndex(isHeader);
  return firstHeader < 0 ? rows.length : firstHeader;
}

/**
 * Where moved rows that hold a section land for a drop before row
 * `requested`: at the start of the section the drop falls in. A drop on the
 * lower half of a row (`after`) never snaps back above that row; it goes to
 * the start of the next section, or to the end.
 */
export function sectionDropIndex<T>(
  rows: readonly T[],
  {requested, after}: {readonly requested: number; readonly after: boolean},
  isHeader: (row: T) => boolean,
): number {
  const index = sectionBoundaryIndex(rows, requested, isHeader);
  if (!after || index >= requested) return index;
  const next = rows.findIndex(
    (row, position) => position >= requested && isHeader(row),
  );
  return next < 0 ? rows.length : next;
}
