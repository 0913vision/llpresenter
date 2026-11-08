import type {ThemeGradient} from '@core/schema/themeBackground';
import {themeGradientColorAt} from './themeBackground';

/** Uses the browser's output color conversion rather than a separate OKLCH implementation. */
export function sampleThemeGradient(
  gradient: ThemeGradient,
  position: number,
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.fillStyle = themeGradientColorAt(gradient, position);
  context.fillRect(0, 0, 1, 1);
  const channels = context.getImageData(0, 0, 1, 1).data;
  return `#${Array.from(channels.slice(0, 3), channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
