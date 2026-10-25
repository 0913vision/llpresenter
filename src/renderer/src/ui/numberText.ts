/** The range a number field accepts. */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

const DECIMAL_TEXT = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const MAX_FIXED_DIGITS = 100;

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
  if (!DECIMAL_TEXT.test(bare)) return undefined;
  const value = Number(bare);
  return Number.isFinite(value) ? value : undefined;
}

/** Snaps a value to the nearest value in the range. */
export function clampNumber(value: number, {min, max}: NumberRange): number {
  return Math.min(max, Math.max(min, value));
}

function decimalPlaces(value: number): number {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  const [, fraction = ''] = mantissa.split('.');
  return Math.min(
    MAX_FIXED_DIGITS,
    Math.max(0, fraction.length - Number(exponent)),
  );
}

/** Rounds to the nearest zero-based whole step. */
export function roundNumberToStep(value: number, step: number): number {
  const count = value / step;
  const rounded = Math.round(count + Math.abs(count) * Number.EPSILON);
  return Number((rounded * step).toFixed(decimalPlaces(step)));
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

/** Pads to step precision without rounding away digits from the value. */
export function formatNumberText(
  value: number,
  suffix: string,
  step = 1,
): string {
  const places = Math.max(decimalPlaces(value), decimalPlaces(step));
  return `${value.toFixed(places)}${suffix}`;
}
