/** The range a number field accepts. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Reads the number in a number field's text, ignoring surrounding spaces and
 * the attached suffix (such as `%`). Returns `undefined` when there is none.
 */
export function parseNumberText(
  text: string,
  suffix: string,
): number | undefined {
  const trimmed = text.trim();
  const bare =
    suffix !== '' && trimmed.endsWith(suffix)
      ? trimmed.slice(0, -suffix.length).trim()
      : trimmed;
  if (bare === '') return undefined;
  const value = Number(bare);
  return Number.isFinite(value) ? value : undefined;
}

/** Snaps a value to the nearest value in the range. */
export function clampNumber(value: number, {min, max}: NumberRange): number {
  return Math.min(max, Math.max(min, value));
}

function decimalPlaces(value: number): number {
  const [, fraction = ''] = String(value).split('.');
  return fraction.length;
}

/**
 * Moves `value` by `steps` steps of size `step` and keeps it in the range,
 * rounding away the floating point error of decimal steps.
 */
export function stepNumber(
  value: number,
  {
    step,
    steps,
    range,
  }: {
    readonly step: number;
    readonly steps: number;
    readonly range: NumberRange;
  },
): number {
  const places = Math.max(decimalPlaces(value), decimalPlaces(step));
  const moved = Number((value + step * steps).toFixed(places));
  return clampNumber(moved, range);
}

/** Writes a value the way a number field shows it, with its suffix. */
export function formatNumberText(value: number, suffix: string): string {
  return `${value}${suffix}`;
}
