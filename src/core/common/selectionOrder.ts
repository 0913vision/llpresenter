/** Expands selected sections once and returns rows in document order. */
export function orderedSelection<T extends {readonly id: string}>(
  rows: readonly T[],
  ids: ReadonlySet<string>,
  section?: (row: T) => boolean,
): readonly T[] {
  let included = false;
  return rows.filter(row => {
    if (section?.(row)) included = ids.has(row.id);
    return included || ids.has(row.id);
  });
}

/** Moves a selection to a gap in the original order, preserving relative order. */
export function moveSelection<T extends {readonly id: string}>(
  rows: readonly T[],
  ids: ReadonlySet<string>,
  boundary: number,
): readonly T[] {
  const selected = rows.filter(row => ids.has(row.id));
  if (selected.length === 0 || boundary < 0 || boundary > rows.length) {
    return rows;
  }
  return [
    ...rows.slice(0, boundary).filter(row => !ids.has(row.id)),
    ...selected,
    ...rows.slice(boundary).filter(row => !ids.has(row.id)),
  ];
}
