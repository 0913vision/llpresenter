/** Measurements are scoped to a view and retained only for current slide ids. */
export interface SlideRowMeasurements {
  readonly scope: string;
  readonly ids: ReadonlySet<string>;
  readonly values: Readonly<Record<string, number>>;
}

/** Reuse measurements only while their slide and zoom still exist. */
export function reconcileSlideRowMeasurements(
  current: SlideRowMeasurements,
  scope: string,
  ids: readonly string[],
): SlideRowMeasurements {
  const allowed = new Set(ids);
  if (
    current.scope === scope &&
    current.ids.size === allowed.size &&
    [...allowed].every(id => current.ids.has(id))
  ) {
    return current;
  }
  const values: Record<string, number> = {};
  if (current.scope === scope) {
    for (const [id, height] of Object.entries(current.values)) {
      if (allowed.has(id)) values[id] = height;
    }
  }
  return {scope, ids: allowed, values};
}
