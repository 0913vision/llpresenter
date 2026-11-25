import {NDI_DEFAULT_FPS} from '@core/schema/screens/screens';
import type {OutputScreen} from '../screens';

/** What a change of a screen's NDI settings asks of its sender. */
export interface NdiSettingsChange {
  /** The sender starts again under its new name or frame rate. */
  readonly restart: boolean;
  /** The rate the offscreen page draws at now, when the frame rate changed. */
  readonly frameRate: 30 | 60 | undefined;
}

function fpsOf(screen: OutputScreen): number {
  return screen.ndi?.fps ?? NDI_DEFAULT_FPS;
}

/**
 * Compares the NDI settings of a screen before and after a change: a new
 * source name or frame rate restarts the sender, and a new frame rate also
 * sets how often the page draws (60 above 30 frames a second, else 30).
 */
export function ndiSettingsChange(
  current: OutputScreen,
  next: OutputScreen,
): NdiSettingsChange {
  const rateChanged = fpsOf(next) !== fpsOf(current);
  return {
    restart: rateChanged || next.ndi?.sourceName !== current.ndi?.sourceName,
    frameRate: rateChanged ? (fpsOf(next) > 30 ? 60 : 30) : undefined,
  };
}
