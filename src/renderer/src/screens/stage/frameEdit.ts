import type {StageElement} from '@shared/schema/stageLayouts';

export const resizeHandles = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
] as const;
export type ResizeHandle = (typeof resizeHandles)[number];
export type ElementFrame = StageElement['frame'];
const MIN_SIZE = 1;

// TODO(0913vision): Add smart guides after the shared guide tokens are available.

/** Applies a canvas-pixel gesture without flipping a handle past its opposite edge. */
export function editFrame(
  frame: ElementFrame,
  delta: {x: number; y: number},
  handle: ResizeHandle | 'move',
): ElementFrame {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return frame;
  if (handle === 'move') {
    const x = Math.round(frame.x + delta.x),
      y = Math.round(frame.y + delta.y);
    return Number.isFinite(x) && Number.isFinite(y) ? {...frame, x, y} : frame;
  }
  const right = frame.x + frame.w,
    bottom = frame.y + frame.h;
  const x = handle.includes('w')
    ? Math.min(right - MIN_SIZE, Math.round(frame.x + delta.x))
    : frame.x;
  const y = handle.includes('n')
    ? Math.min(bottom - MIN_SIZE, Math.round(frame.y + delta.y))
    : frame.y;
  const w = handle.includes('w')
    ? right - x
    : handle.includes('e')
      ? Math.max(MIN_SIZE, Math.round(frame.w + delta.x))
      : frame.w;
  const h = handle.includes('n')
    ? bottom - y
    : handle.includes('s')
      ? Math.max(MIN_SIZE, Math.round(frame.h + delta.y))
      : frame.h;
  return [x, y, w, h].every(Number.isFinite) ? {...frame, x, y, w, h} : frame;
}
