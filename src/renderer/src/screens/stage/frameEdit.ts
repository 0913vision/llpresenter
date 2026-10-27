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
export type FrameField = 'x' | 'y' | 'w' | 'h';
export interface FrameFieldChange {
  readonly field: FrameField;
  readonly value: number;
  readonly keepRatio?: boolean;
}
const MIN_SIZE = 1;

/** Applies a canvas-pixel gesture without flipping a handle past its opposite edge. */
export function editFrame(
  frame: ElementFrame,
  delta: {x: number; y: number},
  {
    handle,
    keepRatio = false,
    ratioAxis,
    precision = 'pixel',
  }: {
    handle: ResizeHandle | 'move';
    keepRatio?: boolean;
    ratioAxis?: 'x' | 'y';
    precision?: 'pixel' | 'pointer';
  },
): ElementFrame {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return frame;
  const round = precision === 'pixel' ? Math.round : (value: number) => value;
  if (handle === 'move') {
    const x = round(frame.x + delta.x),
      y = round(frame.y + delta.y);
    return Number.isFinite(x) && Number.isFinite(y) ? {...frame, x, y} : frame;
  }
  const right = frame.x + frame.w,
    bottom = frame.y + frame.h;
  const x = handle.includes('w')
    ? Math.min(right - MIN_SIZE, round(frame.x + delta.x))
    : frame.x;
  const y = handle.includes('n')
    ? Math.min(bottom - MIN_SIZE, round(frame.y + delta.y))
    : frame.y;
  const w = handle.includes('w')
    ? right - x
    : handle.includes('e')
      ? Math.max(MIN_SIZE, round(frame.w + delta.x))
      : frame.w;
  const h = handle.includes('n')
    ? bottom - y
    : handle.includes('s')
      ? Math.max(MIN_SIZE, round(frame.h + delta.y))
      : frame.h;
  if (![x, y, w, h].every(Number.isFinite)) return frame;
  const next = {...frame, x, y, w, h};
  return keepRatio && frame.w > 0 && frame.h > 0
    ? resizeWithRatio(frame, next, {handle, ratioAxis, round})
    : next;
}

function resizeWithRatio(
  frame: ElementFrame,
  next: ElementFrame,
  {
    handle,
    ratioAxis,
    round,
  }: {
    handle: ResizeHandle;
    ratioAxis: 'x' | 'y' | undefined;
    round: (value: number) => number;
  },
): ElementFrame {
  const horizontal = handle.includes('w') || handle.includes('e');
  const vertical = handle.includes('n') || handle.includes('s');
  const widthDrives =
    horizontal &&
    (!vertical ||
      (ratioAxis === undefined
        ? Math.abs(next.w / frame.w - 1) >= Math.abs(next.h / frame.h - 1)
        : ratioAxis === 'x'));
  const scale = Math.max(
    widthDrives ? next.w / frame.w : next.h / frame.h,
    MIN_SIZE / frame.w,
    MIN_SIZE / frame.h,
  );
  const w = Math.max(MIN_SIZE, round(frame.w * scale));
  const h = Math.max(MIN_SIZE, round(frame.h * scale));
  const x = handle.includes('w')
    ? frame.x + frame.w - w
    : handle.includes('e')
      ? frame.x
      : frame.x + (frame.w - w) / 2;
  const y = handle.includes('n')
    ? frame.y + frame.h - h
    : handle.includes('s')
      ? frame.y
      : frame.y + (frame.h - h) / 2;
  return [x, y, w, h].every(Number.isFinite) ? {...frame, x, y, w, h} : frame;
}

/** Changes one numeric field on the newest frame; ratio resizing keeps its origin. */
export function editFrameValue(
  frame: ElementFrame,
  {field, value, keepRatio = false}: FrameFieldChange,
  bounds: {width: number; height: number},
): ElementFrame {
  if (!Number.isFinite(value)) return frame;
  const limit = field === 'x' || field === 'w' ? bounds.width : bounds.height;
  const minimum = field === 'x' || field === 'y' ? 0 : Math.min(20, limit);
  const next = Math.round(Math.max(minimum, Math.min(limit, value)));
  if (next === frame[field]) return frame;
  if (
    !keepRatio ||
    field === 'x' ||
    field === 'y' ||
    frame.w <= 0 ||
    frame.h <= 0
  ) {
    return {...frame, [field]: next};
  }
  const scale = Math.min(
    Math.max(
      next / frame[field],
      Math.min(20, bounds.width) / frame.w,
      Math.min(20, bounds.height) / frame.h,
    ),
    bounds.width / frame.w,
    bounds.height / frame.h,
  );
  const w = Math.max(MIN_SIZE, Math.round(frame.w * scale));
  const h = Math.max(MIN_SIZE, Math.round(frame.h * scale));
  return w === frame.w && h === frame.h ? frame : {...frame, w, h};
}
