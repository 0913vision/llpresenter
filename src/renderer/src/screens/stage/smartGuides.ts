import {editFrame, type ElementFrame, type ResizeHandle} from './frameEdit';
import {snapToGrid} from './gridSnap';

type Axis = 'x' | 'y';
export interface GuideLines {
  readonly x?: number;
  readonly y?: number;
}
interface Match {
  readonly position: number;
  readonly offset: number;
}
interface GuideGesture {
  readonly start: ElementFrame;
  readonly delta: {x: number; y: number};
  readonly handle: ResizeHandle | 'move';
  readonly keepRatio: boolean;
  readonly snapGrid: boolean;
  readonly bypass: boolean;
  readonly scale: number;
  readonly distance: number;
  readonly targets: readonly ElementFrame[];
}
const MIN_SIZE = 1;
const ALIGNMENT_EPSILON = 0.000001;

function anchors(frame: ElementFrame, axis: Axis): readonly number[] {
  const length = axis === 'x' ? frame.w : frame.h;
  return [frame[axis], frame[axis] + length / 2, frame[axis] + length];
}

function movingAnchors(
  frame: ElementFrame,
  axis: Axis,
  handle: GuideGesture['handle'],
): readonly number[] {
  const values = anchors(frame, axis);
  if (handle === 'move') return values;
  if (handle.includes(axis === 'x' ? 'w' : 'n')) return values.slice(0, 1);
  if (handle.includes(axis === 'x' ? 'e' : 's')) return values.slice(2);
  return [];
}

function matchedFrame(
  frame: ElementFrame,
  match: Match,
  {axis, handle}: {axis: Axis; handle: GuideGesture['handle']},
): ElementFrame {
  if (handle === 'move') return {...frame, [axis]: frame[axis] + match.offset};
  const length = axis === 'x' ? 'w' : 'h';
  return handle.includes(axis === 'x' ? 'w' : 'n')
    ? {
        ...frame,
        [axis]: frame[axis] + match.offset,
        [length]: frame[length] - match.offset,
      }
    : {...frame, [length]: frame[length] + match.offset};
}

function nearest(
  frame: ElementFrame,
  axis: Axis,
  gesture: GuideGesture,
): Match | undefined {
  let best: Match | undefined;
  for (const position of gesture.targets.flatMap(target =>
    anchors(target, axis),
  )) {
    for (const value of movingAnchors(frame, axis, gesture.handle)) {
      const offset = position - value;
      if (Math.abs(offset) * gesture.scale > gesture.distance) continue;
      if (best !== undefined && Math.abs(offset) >= Math.abs(best.offset)) {
        continue;
      }
      const candidate = matchedFrame(
        frame,
        {position, offset},
        {axis, handle: gesture.handle},
      );
      const next =
        gesture.keepRatio && gesture.handle !== 'move'
          ? keepAspect(candidate, gesture, axis)
          : candidate;
      if (next.w >= MIN_SIZE && next.h >= MIN_SIZE) best = {position, offset};
    }
  }
  return best;
}

function keepAspect(
  frame: ElementFrame,
  gesture: GuideGesture,
  axis: Axis,
): ElementFrame {
  const {start, handle} = gesture;
  const scale = axis === 'x' ? frame.w / start.w : frame.h / start.h;
  const w = start.w * scale,
    h = start.h * scale;
  return {
    ...frame,
    w,
    h,
    x: handle.includes('w')
      ? start.x + start.w - w
      : handle.includes('e')
        ? start.x
        : start.x + (start.w - w) / 2,
    y: handle.includes('n')
      ? start.y + start.h - h
      : handle.includes('s')
        ? start.y
        : start.y + (start.h - h) / 2,
  };
}

/** Resolves viewport-distance guides before the independent document grid. */
export function guideFrame(gesture: GuideGesture): {
  frame: ElementFrame;
  guides: GuideLines;
} {
  const {start, delta, bypass, scale, distance, handle, keepRatio} = gesture;
  const grid =
    gesture.snapGrid && !bypass ? snapToGrid(start, delta, gesture) : {delta};
  const fallback = editFrame(start, grid.delta, {
    handle,
    keepRatio,
    ...('ratioAxis' in grid ? {ratioAxis: grid.ratioAxis} : {}),
  });
  if (
    bypass ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(distance) ||
    distance < 0 ||
    !Number.isFinite(delta.x) ||
    !Number.isFinite(delta.y) ||
    (delta.x === 0 && delta.y === 0)
  ) {
    return {frame: fallback, guides: {}};
  }
  const raw = editFrame(start, delta, {
    handle,
    keepRatio,
    precision: 'pointer',
  });
  const x = nearest(raw, 'x', gesture),
    y = nearest(raw, 'y', gesture);
  let frame = fallback;
  if (keepRatio && handle !== 'move' && (x !== undefined || y !== undefined)) {
    const axis =
      x !== undefined &&
      (y === undefined || Math.abs(x.offset) <= Math.abs(y.offset))
        ? 'x'
        : 'y';
    const match = axis === 'x' ? x : y;
    if (match !== undefined) {
      const next = keepAspect(
        matchedFrame(raw, match, {axis, handle}),
        gesture,
        axis,
      );
      if (next.w >= MIN_SIZE && next.h >= MIN_SIZE) frame = next;
    }
  } else {
    if (x !== undefined) {
      const next = matchedFrame(raw, x, {axis: 'x', handle});
      frame = {...frame, x: next.x, w: next.w};
    }
    if (y !== undefined) {
      const next = matchedFrame(raw, y, {axis: 'y', handle});
      frame = {...frame, y: next.y, h: next.h};
    }
  }
  const aligned = (axis: Axis, match: Match | undefined): boolean =>
    match !== undefined &&
    movingAnchors(frame, axis, handle).some(
      value => Math.abs(value - match.position) < ALIGNMENT_EPSILON,
    );
  return {
    frame,
    guides: {
      ...(aligned('x', x) && x !== undefined ? {x: x.position} : {}),
      ...(aligned('y', y) && y !== undefined ? {y: y.position} : {}),
    },
  };
}
