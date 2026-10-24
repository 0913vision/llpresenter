/** A rectangle in window coordinates, as from `getBoundingClientRect()`. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The space floating surfaces keep from the window edges. */
export const WINDOW_EDGE = 8;
/** The gap between a target and its tooltip. */
export const TOOLTIP_GAP = 6;
/** The gap between a button and the menu or list it opens. */
export const POPOVER_GAP = 4;
/** How far a submenu overlaps its parent menu. */
export const SUBMENU_OVERLAP = 4;
/** How far a submenu rises so that its first item lines up with its parent. */
export const SUBMENU_RISE = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function keepInside(start: number, length: number, limit: number): number {
  return clamp(
    start,
    WINDOW_EDGE,
    Math.max(WINDOW_EDGE, limit - WINDOW_EDGE - length),
  );
}

function bottom(box: Box): number {
  return box.top + box.height;
}

function right(box: Box): number {
  return box.left + box.width;
}

/** A floating surface that opens beside an anchor, `gap` away from it. */
interface Opening {
  readonly anchor: Box;
  readonly height: number;
  readonly gap: number;
}

/** Below the box if it fits, else above it, else pinned inside the window. */
function belowOrAbove({anchor, height, gap}: Opening, viewport: Size): number {
  const below = bottom(anchor) + gap;
  if (below + height <= viewport.height - WINDOW_EDGE) return below;
  const above = anchor.top - gap - height;
  if (above >= WINDOW_EDGE) return above;
  return keepInside(below, height, viewport.height);
}

/**
 * Places a tooltip 6px below its target, centered on it, or left-aligned when
 * the target is wider than the tooltip. It flips above when there is no room
 * below, and stays 8px inside the window edges.
 */
export function placeTooltip(
  target: Box,
  tooltip: Size,
  viewport: Size,
): Point {
  const x =
    target.width > tooltip.width
      ? target.left
      : target.left + (target.width - tooltip.width) / 2;
  return {
    x: keepInside(x, tooltip.width, viewport.width),
    y: belowOrAbove(
      {anchor: target, height: tooltip.height, gap: TOOLTIP_GAP},
      viewport,
    ),
  };
}

/**
 * Places a menu or list 4px below the button that opens it, left edges
 * aligned, or 4px above the button when there is no room below.
 */
export function placeBelow(anchor: Box, popover: Size, viewport: Size): Point {
  return {
    x: keepInside(anchor.left, popover.width, viewport.width),
    y: belowOrAbove(
      {anchor, height: popover.height, gap: POPOVER_GAP},
      viewport,
    ),
  };
}

/**
 * Places a right-click menu with its top-left corner at the pointer, flipping
 * to the left or up when it would cross the right or bottom window edge.
 */
export function placeAtPoint(
  point: Point,
  popover: Size,
  viewport: Size,
): Point {
  const fitsRight = point.x + popover.width <= viewport.width - WINDOW_EDGE;
  const fitsBelow = point.y + popover.height <= viewport.height - WINDOW_EDGE;
  const x = fitsRight ? point.x : point.x - popover.width;
  const y = fitsBelow ? point.y : point.y - popover.height;
  return {
    x: keepInside(x, popover.width, viewport.width),
    y: keepInside(y, popover.height, viewport.height),
  };
}

/**
 * Places a submenu so that its first item lines up with the parent item. It
 * overlaps the right edge of the parent menu by 4px, or opens on the left
 * with the same overlap when there is no room on the right.
 */
export function placeSubmenu(
  parent: {readonly item: Box; readonly menu: Box},
  submenu: Size,
  viewport: Size,
): Point {
  const {item: parentItem, menu: parentMenu} = parent;
  const onRight = right(parentMenu) - SUBMENU_OVERLAP;
  const onLeft = parentMenu.left + SUBMENU_OVERLAP - submenu.width;
  const fitsRight = onRight + submenu.width <= viewport.width - WINDOW_EDGE;
  return {
    x: keepInside(fitsRight ? onRight : onLeft, submenu.width, viewport.width),
    y: keepInside(
      parentItem.top - SUBMENU_RISE,
      submenu.height,
      viewport.height,
    ),
  };
}

/** The tallest a menu may be: the window height less 8px at each end. */
export function maxPopoverHeight(viewport: Size): number {
  return Math.max(0, viewport.height - 2 * WINDOW_EDGE);
}

/** The window size as a `Size`. */
export function viewportSize(): Size {
  return {width: window.innerWidth, height: window.innerHeight};
}
