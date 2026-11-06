import type {LabelColor} from './colors';

export interface HsvColor {
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
}

export function colorToHsv(color: LabelColor): HsvColor {
  const hex = color === 'none' ? '#FF0000' : color;
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const sector =
    delta === 0
      ? 0
      : max === red
        ? (green - blue) / delta
        : max === green
          ? (blue - red) / delta + 2
          : (red - green) / delta + 4;
  return {
    hue: (sector * 60 + 360) % 360,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    brightness: max * 100,
  };
}

export function hsvToColor({
  hue,
  saturation,
  brightness,
}: HsvColor): LabelColor {
  const value = brightness / 100;
  const amplitude = (saturation / 100) * value;
  const channel = (offset: number): string => {
    const sector = (offset + hue / 60) % 6;
    const number =
      value - amplitude * Math.max(0, Math.min(sector, 4 - sector, 1));
    return Math.round(number * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${(channel(5) + channel(3) + channel(1)).toUpperCase()}`;
}
