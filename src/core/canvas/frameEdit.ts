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
export interface ElementFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly [key: string]: unknown;
}
export type FrameField = 'x' | 'y' | 'w' | 'h';
export interface FrameFieldChange {
  readonly field: FrameField;
  readonly value: number;
  readonly keepRatio?: boolean;
}
export const MIN_SIZE = 20;

/** Applies a canvas-pixel gesture without flipping a handle past its opposite edge. */
export function editFrame(
  frame: ElementFrame,
  delta: {x: number; y: number},
  {
    handle,
    keepRatio = false,
    ratioAxis,
    precision = 'pixel',
    minimumSize = MIN_SIZE,
  }: {
    handle: ResizeHandle | 'move';
    keepRatio?: boolean;
    ratioAxis?: 'x' | 'y';
    precision?: 'pixel' | 'pointer';
    minimumSize?: number;
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
    ? Math.min(right - minimumSize, round(frame.x + delta.x))
    : frame.x;
  const y = handle.includes('n')
    ? Math.min(bottom - minimumSize, round(frame.y + delta.y))
    : frame.y;
  const w = handle.includes('w')
    ? right - x
    : handle.includes('e')
      ? Math.max(minimumSize, round(frame.w + delta.x))
      : frame.w;
  const h = handle.includes('n')
    ? bottom - y
    : handle.includes('s')
      ? Math.max(minimumSize, round(frame.h + delta.y))
      : frame.h;
  if (![x, y, w, h].every(Number.isFinite)) return frame;
  const next = {...frame, x, y, w, h};
  return keepRatio && frame.w > 0 && frame.h > 0
    ? resizeWithRatio(frame, next, {handle, ratioAxis, round, minimumSize})
    : next;
}

function resizeWithRatio(
  frame: ElementFrame,
  next: ElementFrame,
  {
    handle,
    ratioAxis,
    round,
    minimumSize,
  }: {
    handle: ResizeHandle;
    ratioAxis: 'x' | 'y' | undefined;
    round: (value: number) => number;
    minimumSize: number;
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
    minimumSize / frame.w,
    minimumSize / frame.h,
  );
  const w = Math.max(minimumSize, round(frame.w * scale));
  const h = Math.max(minimumSize, round(frame.h * scale));
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
  bounds: {width: number; height: number; minimumSize?: number},
): ElementFrame {
  if (!Number.isFinite(value)) return frame;
  const minimumSize = bounds.minimumSize ?? MIN_SIZE;
  const limit = field === 'x' || field === 'w' ? bounds.width : bounds.height;
  const minimum =
    field === 'x' || field === 'y' ? 0 : Math.min(minimumSize, limit);
  const next = Math.max(minimum, Math.min(limit, value));
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
  const requestedScale = next / frame[field];
  const scale = Math.min(
    Math.max(
      requestedScale,
      Math.min(minimumSize, bounds.width) / frame.w,
      Math.min(minimumSize, bounds.height) / frame.h,
    ),
    bounds.width / frame.w,
    bounds.height / frame.h,
  );
  const w = Math.max(
    minimumSize,
    field === 'w' && scale === requestedScale ? next : frame.w * scale,
  );
  const h = Math.max(
    minimumSize,
    field === 'h' && scale === requestedScale ? next : frame.h * scale,
  );
  return w === frame.w && h === frame.h ? frame : {...frame, w, h};
}

/** Keeps the complete frame inside a reference canvas, preserving its unknown fields. */
export function frameWithinBounds(
  frame: ElementFrame,
  bounds: {width: number; height: number; minimumSize?: number},
): ElementFrame {
  const minimum = bounds.minimumSize ?? MIN_SIZE;
  const w = Math.max(minimum, Math.min(bounds.width, frame.w));
  const h = Math.max(minimum, Math.min(bounds.height, frame.h));
  const x = Math.max(0, Math.min(bounds.width - w, frame.x));
  const y = Math.max(0, Math.min(bounds.height - h, frame.y));
  return x === frame.x && y === frame.y && w === frame.w && h === frame.h
    ? frame
    : {...frame, x, y, w, h};
}

/** Constrains resize anchors and the original aspect ratio at canvas edges. */
export function containFrameGesture(
  frame: ElementFrame,
  {
    start,
    handle,
    keepRatio,
    bounds,
  }: {
    readonly start: ElementFrame;
    readonly handle: ResizeHandle | 'move';
    readonly keepRatio: boolean;
    readonly bounds: {width: number; height: number; minimumSize?: number};
  },
): ElementFrame {
  if (
    frame.x >= 0 &&
    frame.y >= 0 &&
    frame.x + frame.w <= bounds.width &&
    frame.y + frame.h <= bounds.height
  ) {
    return frame;
  }
  if (handle === 'move') return frameWithinBounds(frame, bounds);
  const minimum = bounds.minimumSize ?? MIN_SIZE;
  if (!keepRatio) {
    const x = Math.max(0, frame.x);
    const y = Math.max(0, frame.y);
    return {
      ...frame,
      x,
      y,
      w: Math.max(minimum, Math.min(bounds.width, frame.x + frame.w) - x),
      h: Math.max(minimum, Math.min(bounds.height, frame.y + frame.h) - y),
    };
  }
  const anchorX = handle.includes('w')
    ? start.x + start.w
    : handle.includes('e')
      ? start.x
      : start.x + start.w / 2;
  const anchorY = handle.includes('n')
    ? start.y + start.h
    : handle.includes('s')
      ? start.y
      : start.y + start.h / 2;
  const maximumWidth = handle.includes('w')
    ? anchorX
    : handle.includes('e')
      ? bounds.width - anchorX
      : 2 * Math.min(anchorX, bounds.width - anchorX);
  const maximumHeight = handle.includes('n')
    ? anchorY
    : handle.includes('s')
      ? bounds.height - anchorY
      : 2 * Math.min(anchorY, bounds.height - anchorY);
  const scale = Math.max(
    minimum / start.w,
    minimum / start.h,
    Math.min(
      frame.w / start.w,
      frame.h / start.h,
      maximumWidth / start.w,
      maximumHeight / start.h,
    ),
  );
  const w = start.w * scale;
  const h = start.h * scale;
  return {
    ...frame,
    w,
    h,
    x: handle.includes('w')
      ? anchorX - w
      : handle.includes('e')
        ? anchorX
        : anchorX - w / 2,
    y: handle.includes('n')
      ? anchorY - h
      : handle.includes('s')
        ? anchorY
        : anchorY - h / 2,
  };
}
