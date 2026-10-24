import {clampNumber, stepNumber} from './numberText';

/** A slider's range and the size of one step. */
export interface SliderScale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const PAGE_FRACTION = 0.1;
const PERCENT = 100;

/** How far along the track a value sits, from 0 to 100. */
export function sliderPercent(value: number, {min, max}: SliderScale): number {
  if (max <= min) return 0;
  return ((clampNumber(value, {min, max}) - min) / (max - min)) * PERCENT;
}

function pageSteps({min, max, step}: SliderScale): number {
  return Math.max(1, Math.round(((max - min) * PAGE_FRACTION) / step));
}

/**
 * The value a key moves the slider to: one step for the arrows, a tenth of
 * the range for PageUp and PageDown, and the ends for Home and End. Returns
 * `undefined` for any other key.
 */
export function sliderKeyValue(
  key: string,
  value: number,
  scale: SliderScale,
): number | undefined {
  const range = {min: scale.min, max: scale.max};
  const by = (steps: number): number =>
    stepNumber(value, {step: scale.step, steps, range});
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return by(1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return by(-1);
    case 'PageUp':
      return by(pageSteps(scale));
    case 'PageDown':
      return by(-pageSteps(scale));
    case 'Home':
      return scale.min;
    case 'End':
      return scale.max;
    default:
      return undefined;
  }
}
