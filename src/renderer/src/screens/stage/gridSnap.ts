import {
  MIN_SIZE,
  type ElementFrame,
  type ResizeHandle,
} from '@core/looks/frameEdit';

const GRID_STEP = 20;
interface Point {
  x: number;
  y: number;
}

/** Snaps only moving edges to the fixed document grid, preserving legal sizes. */
export function snapToGrid(
  frame: ElementFrame,
  delta: Point,
  {handle, keepRatio}: {handle: ResizeHandle | 'move'; keepRatio: boolean},
): {delta: Point; ratioAxis?: 'x' | 'y'} {
  if (
    !Number.isFinite(delta.x) ||
    !Number.isFinite(delta.y) ||
    (delta.x === 0 && delta.y === 0)
  ) {
    return {delta};
  }
  const snap = (value: number): number =>
    Math.round(value / GRID_STEP) * GRID_STEP;
  const x =
    handle === 'move'
      ? snap(frame.x + delta.x) - frame.x
      : handle.includes('w')
        ? Math.min(
            snap(frame.x + delta.x),
            Math.floor((frame.x + frame.w - MIN_SIZE) / GRID_STEP) * GRID_STEP,
          ) - frame.x
        : handle.includes('e')
          ? Math.max(
              snap(frame.x + frame.w + delta.x),
              Math.ceil((frame.x + MIN_SIZE) / GRID_STEP) * GRID_STEP,
            ) -
            frame.x -
            frame.w
          : delta.x;
  const y =
    handle === 'move'
      ? snap(frame.y + delta.y) - frame.y
      : handle.includes('n')
        ? Math.min(
            snap(frame.y + delta.y),
            Math.floor((frame.y + frame.h - MIN_SIZE) / GRID_STEP) * GRID_STEP,
          ) - frame.y
        : handle.includes('s')
          ? Math.max(
              snap(frame.y + frame.h + delta.y),
              Math.ceil((frame.y + MIN_SIZE) / GRID_STEP) * GRID_STEP,
            ) -
            frame.y -
            frame.h
          : delta.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return {delta};
  const corner = handle !== 'move' && handle.length === 2;
  return keepRatio && corner && frame.w > 0 && frame.h > 0
    ? {
        delta: {x, y},
        ratioAxis:
          Math.abs(delta.x / frame.w) >= Math.abs(delta.y / frame.h)
            ? 'x'
            : 'y',
      }
    : {delta: {x, y}};
}
