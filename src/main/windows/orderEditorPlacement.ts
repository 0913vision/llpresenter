import {parseClientRectJson} from '@core/schema/clientRect';

/** A rectangle in screen pixels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const ORDER_EDITOR_MIN_WIDTH = 640;
export const ORDER_EDITOR_MIN_HEIGHT = 480;
const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT_SHARE = 0.9;

export interface OrderEditorPlacementInput {
  /** The size and place the window was closed with, if it ever was. */
  readonly saved?: Rect | undefined;
  /** The 라이브러리 column in screen pixels, or null when 준비 isn't shown. */
  readonly library: Rect | null;
  /** The work area of the display the window opens on. */
  readonly area: Rect;
}

function between(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function fitInside(rect: Rect, area: Rect): Rect {
  const width = Math.min(rect.width, area.width);
  const height = Math.min(rect.height, area.height);
  return {
    width,
    height,
    x: between(rect.x, area.x, area.x + area.width - width),
    y: between(rect.y, area.y, area.y + area.height - height),
  };
}

/**
 * Where the 순서 편집 window opens: its left edge at the 라이브러리's right
 * edge and its top at the 라이브러리's top, so media can still be dragged from
 * the library. Without a library it keeps its saved place, or centers.
 */
export function orderEditorPlacement({
  saved,
  library,
  area,
}: OrderEditorPlacementInput): Rect {
  const width = between(
    saved?.width ?? DEFAULT_WIDTH,
    ORDER_EDITOR_MIN_WIDTH,
    Math.max(ORDER_EDITOR_MIN_WIDTH, area.width),
  );
  const height = between(
    saved?.height ?? library?.height ?? area.height * DEFAULT_HEIGHT_SHARE,
    ORDER_EDITOR_MIN_HEIGHT,
    Math.max(ORDER_EDITOR_MIN_HEIGHT, area.height),
  );
  const x =
    library === null
      ? (saved?.x ?? area.x + (area.width - width) / 2)
      : library.x + library.width;
  const y =
    library === null
      ? (saved?.y ?? area.y + (area.height - height) / 2)
      : library.y;
  return fitInside({x: Math.round(x), y: Math.round(y), width, height}, area);
}

/** The script that reads the 라이브러리 column in the control page. */
export const LIBRARY_RECT_SCRIPT =
  'JSON.stringify(document.querySelector(\'[aria-label="라이브러리"]\')?.getBoundingClientRect() ?? null)';

/**
 * Turns the answer of {@link LIBRARY_RECT_SCRIPT} into screen pixels, from the
 * control window's content origin and zoom factor. Anything else is null.
 */
export function libraryRectOnScreen(
  reply: unknown,
  origin: {readonly x: number; readonly y: number},
  zoomFactor: number,
): Rect | null {
  const parsed = parseClientRectJson(reply);
  if (!parsed.ok) return null;
  const {left, top, right, bottom} = parsed.value;
  if (right <= left || bottom <= top) return null;
  return {
    x: Math.round(origin.x + left * zoomFactor),
    y: Math.round(origin.y + top * zoomFactor),
    width: Math.round((right - left) * zoomFactor),
    height: Math.round((bottom - top) * zoomFactor),
  };
}
