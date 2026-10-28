export interface HsvColor {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

const CHANNEL_MAX = 255;
const PERCENT_MAX = 100;
const HUE_CIRCLE = 360;
const HUE_SECTOR = 60;

/** Converts a validated #RRGGBB color to hue, saturation and value. */
export function hsvFromHex(hex: string): HsvColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / CHANNEL_MAX;
  const green = Number.parseInt(hex.slice(3, 5), 16) / CHANNEL_MAX;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / CHANNEL_MAX;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let sector = 0;
  if (delta !== 0) {
    if (max === red) sector = (green - blue) / delta;
    else if (max === green) sector = (blue - red) / delta + 2;
    else sector = (red - green) / delta + 4;
  }
  return {
    hue: (sector * HUE_SECTOR + HUE_CIRCLE) % HUE_CIRCLE,
    saturation: max === 0 ? 0 : (delta / max) * PERCENT_MAX,
    value: max * PERCENT_MAX,
  };
}

function channel(value: number): string {
  return Math.round(value * CHANNEL_MAX)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/** Converts a bounded HSV selection to a canonical #RRGGBB color. */
export function hexFromHsv({hue, saturation, value}: HsvColor): string {
  const normalized = ((hue % HUE_CIRCLE) + HUE_CIRCLE) % HUE_CIRCLE;
  const chroma =
    (Math.min(PERCENT_MAX, Math.max(0, value)) / PERCENT_MAX) *
    (Math.min(PERCENT_MAX, Math.max(0, saturation)) / PERCENT_MAX);
  const intermediate =
    chroma * (1 - Math.abs(((normalized / HUE_SECTOR) % 2) - 1));
  const base = Math.min(PERCENT_MAX, Math.max(0, value)) / PERCENT_MAX - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (normalized < HUE_SECTOR) [red, green] = [chroma, intermediate];
  else if (normalized < HUE_SECTOR * 2) [red, green] = [intermediate, chroma];
  else if (normalized < HUE_SECTOR * 3) [green, blue] = [chroma, intermediate];
  else if (normalized < HUE_SECTOR * 4) [green, blue] = [intermediate, chroma];
  else if (normalized < HUE_SECTOR * 5) [red, blue] = [intermediate, chroma];
  else [red, blue] = [chroma, intermediate];
  return `#${channel(red + base)}${channel(green + base)}${channel(blue + base)}`;
}
