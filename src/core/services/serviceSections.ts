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
