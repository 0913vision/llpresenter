import {THEME_CANVAS, type Screen} from '@core/schema/screens';

/** The saved size that determines this screen's output aspect ratio. */
export function pictureSizeForScreen(
  screen: Screen,
): {readonly width: number; readonly height: number} | undefined {
  if (screen.method === 'ndi') return screen.ndi?.resolution;
  if (screen.method === 'capture') return screen.resolution;
  if (screen.method === 'fullscreen' && screen.display !== undefined) {
    const {width, height} = screen.display.bounds;
    return {width, height};
  }
  return undefined;
}

const {width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT} = THEME_CANVAS;

/** Where a picture of this size lies inside a 16:9 preview frame. */
export function pictureBounds(
  size: {readonly width: number; readonly height: number} | undefined,
) {
  if (size === undefined) {
    return {x: 0, y: 0, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT};
  }
  const scale = Math.min(
    PREVIEW_WIDTH / size.width,
    PREVIEW_HEIGHT / size.height,
  );
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  return {
    x: Math.floor((PREVIEW_WIDTH - width) / 2),
    y: Math.floor((PREVIEW_HEIGHT - height) / 2),
    width,
    height,
  };
}
