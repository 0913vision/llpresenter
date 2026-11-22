import {roundGeometryFrame} from '../canvas/geometryValue';
import type {
  OwnThemeScreen,
  ThemeElement,
  ThemeFrame,
  ThemeShape,
  ThemeSplit,
  ThemeStack,
} from '../schema/theme';
import {changeElement} from './elements';
import type {ThemePlacement} from './layout';

const SMALLEST = 1;

/** The stack a text stands in. */
export function stackOf(
  screen: OwnThemeScreen,
  id: string,
): ThemeStack | undefined {
  return screen.stacks?.find(stack => stack.texts.some(text => text === id));
}

/** The split a text is the upper or the lower part of. */
export function splitOf(
  screen: OwnThemeScreen,
  id: string,
): ThemeSplit | undefined {
  return screen.splits?.find(
    split => split.lower === id || split.upper.some(text => text === id),
  );
}

/** Where an element is on the canvas: what the operator points at. */
export function drawnFrame(
  screen: OwnThemeScreen,
  element: ThemeElement,
  placement: ThemePlacement,
): ThemeFrame {
  if (element.kind === 'shape') {
    const at = placement.shapes.get(element.id);
    return at === undefined ? element.frame : {...element.frame, ...at};
  }
  if (element.kind !== 'text' && element.kind !== 'next') return element.frame;
  if (
    stackOf(screen, element.id) === undefined &&
    splitOf(screen, element.id) === undefined
  ) {
    return element.frame;
  }
  const at = placement.texts.get(element.id);
  return at === undefined
    ? element.frame
    : {...element.frame, x: at.x, y: at.y, w: at.w, h: at.h};
}

function withStack(
  screen: OwnThemeScreen,
  stack: ThemeStack,
  change: Partial<ThemeStack>,
): OwnThemeScreen {
  return {
    ...screen,
    stacks: (screen.stacks ?? []).map(entry =>
      entry === stack ? {...entry, ...change} : entry,
    ),
  };
}

function withSplit(
  screen: OwnThemeScreen,
  split: ThemeSplit,
  change: Partial<ThemeSplit>,
): OwnThemeScreen {
  return {
    ...screen,
    splits: (screen.splits ?? []).map(entry =>
      entry === split ? {...entry, ...change} : entry,
    ),
  };
}

/** Changes the stack a text stands in. */
export function changeStack(
  screen: OwnThemeScreen,
  id: string,
  change: Partial<ThemeStack>,
): OwnThemeScreen {
  const stack = stackOf(screen, id);
  return stack === undefined ? screen : withStack(screen, stack, change);
}

/** Changes the split a text is in. */
export function changeSplit(
  screen: OwnThemeScreen,
  id: string,
  change: Partial<ThemeSplit>,
): OwnThemeScreen {
  const split = splitOf(screen, id);
  return split === undefined ? screen : withSplit(screen, split, change);
}

function shapeMoved(
  shape: ThemeShape,
  from: ThemeFrame,
  to: ThemeFrame,
): ThemeShape {
  const top = to.y - from.y;
  const bottom = to.y + to.h - (from.y + from.h);
  const {around, beside} = shape;
  if (around !== undefined) {
    return {
      ...shape,
      frame: {...shape.frame, x: to.x, w: to.w},
      around: {
        ...around,
        padding: {
          ...around.padding,
          top: around.padding.top - top,
          bottom: around.padding.bottom + bottom,
        },
      },
    };
  }
  if (beside !== undefined) {
    return {
      ...shape,
      frame: {...shape.frame, x: to.x, w: to.w, h: to.h},
      beside: {
        ...beside,
        gap: beside.gap + (beside.side === 'above' ? -bottom : top),
      },
    };
  }
  return {...shape, frame: {...shape.frame, ...to}};
}

/**
 * Puts an element where the operator dragged it. A text of a stack moves its
 * stack, a text of a split moves its part of the split, and a shape that
 * follows texts changes its distance from them.
 */
export function moveElement(
  screen: OwnThemeScreen,
  id: string,
  {from, to: dragged}: {readonly from: ThemeFrame; readonly to: ThemeFrame},
): OwnThemeScreen | undefined {
  const element = screen.elements.find(entry => entry.id === id);
  if (element === undefined) return undefined;
  const to = {
    ...roundGeometryFrame(dragged),
    w: Math.max(SMALLEST, dragged.w),
    h: Math.max(SMALLEST, dragged.h),
  };
  if (element.kind === 'shape') {
    return changeElement(screen, id, () => shapeMoved(element, from, to));
  }
  const stack = stackOf(screen, id);
  const split = splitOf(screen, id);
  if (stack === undefined && split === undefined) {
    return changeElement(screen, id, entry => ({...entry, frame: to}));
  }
  const down = to.y - from.y;
  const taller = to.h !== from.h;
  const changed = changeElement(screen, id, entry => ({
    ...entry,
    frame: {
      ...entry.frame,
      x: to.x,
      w: to.w,
      h: taller ? to.h : entry.frame.h,
    },
  }));
  if (changed === undefined) return undefined;
  if (stack !== undefined) {
    return withStack(changed, stack, {at: stack.at + down});
  }
  if (split === undefined) return changed;
  if (split.lower === id) {
    return withSplit(changed, split, {at: split.at + down});
  }
  return withSplit(changed, split, {top: split.top + down});
}
