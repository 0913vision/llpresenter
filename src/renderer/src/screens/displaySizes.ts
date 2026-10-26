import type {MonitorInfo} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';

/** A size in pixels. */
export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

// NOTE(0913vision): These match the sizes the output windows open with
// (`CAPTURE_WINDOW_SIZE` and `OUTPUT_WINDOW_SIZE` in main's placement).
const CAPTURE_DEFAULT_SIZE: PixelSize = {width: 1920, height: 1080};
const WINDOW_SIZE: PixelSize = {width: 960, height: 540};

/** The size as `1920×1080`. */
export function sizeText({width, height}: PixelSize): string {
  return `${width}×${height}`;
}

/**
 * A monitor's resolution in device pixels. Its bounds are in device-independent
 * pixels, so a 3840×2160 monitor at 200% has bounds of 1920×1080.
 */
export function monitorPixelSize({
  bounds,
  scaleFactor,
}: MonitorInfo): PixelSize {
  return {
    width: Math.round(bounds.width * scaleFactor),
    height: Math.round(bounds.height * scaleFactor),
  };
}

/**
 * The size of a screen's output that has no monitor: the capture window's
 * chosen or default size, the fixed size of a window, or the chosen NDI size.
 */
export function targetSize(screen: Screen): PixelSize | undefined {
  switch (screen.method) {
    case 'capture':
      return screen.resolution ?? CAPTURE_DEFAULT_SIZE;
    case 'window':
      return WINDOW_SIZE;
    case 'ndi':
    case 'fullscreen':
      return screen.resolution;
    default: {
      const unreachable: never = screen.method;
      return unreachable;
    }
  }
}
