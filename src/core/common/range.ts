/** A closed range of numbers, from `min` to `max`. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

/** Snaps a value to the nearest value in the range. */
export function clamp(value: number, {min, max}: NumberRange): number {
  return Math.min(max, Math.max(min, value));
}
