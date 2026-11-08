import type {
  ThemeBackground,
  ThemeGradient,
} from '@core/schema/themeBackground';

const NOISE_SIZE = 64;
const NEUTRAL_CHANNEL_SPREAD = 2;
const MIN_HUE_CHROMA = 0.0001;
const NOISE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${NOISE_SIZE}" height="${NOISE_SIZE}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="7"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".003"/></svg>`)}")`;

function gradientColor(color: string): string {
  const channels = [1, 3, 5].map(offset =>
    parseInt(color.slice(offset, offset + 2), 16),
  );
  // NOTE(0913vision): A tiny chroma floor keeps exact grays on the same
  // native missing-hue path as near grays instead of spinning their hue.
  return Math.max(...channels) - Math.min(...channels) <= NEUTRAL_CHANNEL_SPREAD
    ? `oklch(from ${color} l max(c, ${MIN_HUE_CHROMA}) none)`
    : color;
}

/** Samples the same shorter-hue interpolation as the output, including hard edges. */
export function themeGradientColorAt(
  gradient: ThemeGradient,
  position: number,
): string {
  let left = gradient.stops[0];
  if (left === undefined) return '#000000';
  if (position < left.position) return left.color;
  for (const right of gradient.stops.slice(1)) {
    if (position < right.position) {
      const amount =
        (position - left.position) / (right.position - left.position);
      return `color-mix(in oklch shorter hue, ${gradientColor(left.color)} ${(1 - amount) * 100}%, ${gradientColor(right.color)} ${amount * 100}%)`;
    }
    left = right;
  }
  return left.color;
}

/** The opaque base under a gradient; a gradient is never a uniform chroma key. */
export function themeBackgroundColor(
  background: ThemeBackground | undefined,
  inherited: string,
): string {
  return typeof background === 'string'
    ? background
    : (background?.stops[0]?.color ?? inherited);
}

/** Shared by live output and SVG previews, with the PowerPoint clockwise angle. */
export function themeBackgroundStyle(
  background: ThemeBackground | undefined,
  inherited = '#000000',
) {
  const color = themeBackgroundColor(background, inherited);
  if (background === undefined || typeof background === 'string') {
    return {
      backgroundColor: color,
      backgroundImage: 'none',
      backgroundSize: 'auto',
      backgroundRepeat: 'no-repeat',
    };
  }
  const stops = background.stops
    .map(stop => `${gradientColor(stop.color)} ${stop.position}%`)
    .join(', ');
  return {
    backgroundColor: color,
    backgroundImage: `${NOISE}, linear-gradient(${(background.angle + 90) % 360}deg in oklch shorter hue, ${stops})`,
    backgroundSize: `${NOISE_SIZE}px ${NOISE_SIZE}px, 100% 100%`,
    backgroundRepeat: 'repeat, no-repeat',
  };
}
