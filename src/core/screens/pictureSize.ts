import type {Screen} from '../schema/screens';

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
