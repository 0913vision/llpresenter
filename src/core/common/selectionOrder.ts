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

/** True when inserting a selection at this original gap leaves its order unchanged. */
export function isUnchangedSelectionMove(
  ids: readonly string[],
  selected: ReadonlySet<string>,
  boundary: number,
): boolean {
  if (boundary < 0 || boundary > ids.length || selected.size === 0) {
    return false;
  }
  const moving = ids.filter(id => selected.has(id));
  if (moving.length === 0) return false;
  const rest = ids.filter(id => !selected.has(id));
  const index = ids.slice(0, boundary).filter(id => !selected.has(id)).length;
  const result = [...rest.slice(0, index), ...moving, ...rest.slice(index)];
  return result.every((id, position) => id === ids[position]);
}
