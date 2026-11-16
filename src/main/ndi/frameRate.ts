import {NDI_DEFAULT_FPS} from '@core/schema/screens';
import type {OutputScreen} from '../outputs/screens';

/** The sender rate saved for this screen, or the default for older settings. */
export function ndiFps(screen: OutputScreen): number {
  return screen.ndi?.fps ?? NDI_DEFAULT_FPS;
}

/** Electron paints at a whole-number rate that can supply the sender. */
export function ndiPaintRate(fps: number): 30 | 60 {
  return fps > 30 ? 60 : 30;
}
