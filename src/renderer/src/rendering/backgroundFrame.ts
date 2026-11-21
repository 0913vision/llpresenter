import type {MediaLayer} from '@core/live/state';
import {THEME_LIMITS} from '@core/themes/elementRules';

/** Place song media identically in cached previews and live output. */
export function applyBackgroundFrame(
  element: HTMLElement,
  frame: MediaLayer['backgroundFrame'],
): void {
  element.style.left =
    frame === undefined ? '' : `${(frame.x / THEME_LIMITS.width) * 100}%`;
  element.style.top =
    frame === undefined ? '' : `${(frame.y / THEME_LIMITS.height) * 100}%`;
  element.style.width =
    frame === undefined ? '' : `${(frame.w / THEME_LIMITS.width) * 100}%`;
  element.style.height =
    frame === undefined ? '' : `${(frame.h / THEME_LIMITS.height) * 100}%`;
}
