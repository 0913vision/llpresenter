import type {ElementFrame} from './frameEdit';

const PIXEL_DIVISIONS = 10;

/** Rounds geometry to tenths of a pixel, with ties toward positive infinity. */
export function roundGeometryValue(value: number): number {
  const scaled = value * PIXEL_DIVISIONS;
  const rounded = Math.round(scaled + Math.abs(scaled) * Number.EPSILON);
  return rounded === 0 ? 0 : rounded / PIXEL_DIVISIONS;
}

export function formatGeometryValue(value: number): string {
  return String(roundGeometryValue(value));
}

export function roundGeometryFrame(frame: ElementFrame): ElementFrame {
  const x = roundGeometryValue(frame.x);
  const y = roundGeometryValue(frame.y);
  const w = roundGeometryValue(frame.w);
  const h = roundGeometryValue(frame.h);
  return x === frame.x && y === frame.y && w === frame.w && h === frame.h
    ? frame
    : {...frame, x, y, w, h};
}
