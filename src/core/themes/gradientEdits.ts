import {
  THEME_BACKGROUND_LIMITS,
  type ThemeGradient,
} from '../schema/themeBackground';

/** Starts every new gradient in the chosen perceptual mixing space. */
export function createThemeGradient(color: string): ThemeGradient {
  return {
    kind: 'linear',
    angle: 135,
    mixing: 'oklch',
    stops: [
      {color, position: 0},
      {color: '#FFFFFF', position: 100},
    ],
  };
}

/** Inserts into the widest interval, retaining the surrounding stop positions. */
export function addGradientStop(gradient: ThemeGradient): ThemeGradient {
  if (gradient.stops.length >= THEME_BACKGROUND_LIMITS.stops) return gradient;
  let at = 1;
  let gap = -1;
  for (let index = 1; index < gradient.stops.length; index++) {
    const left = gradient.stops[index - 1];
    const right = gradient.stops[index];
    if (
      left !== undefined &&
      right !== undefined &&
      right.position - left.position > gap
    ) {
      at = index;
      gap = right.position - left.position;
    }
  }
  const left = gradient.stops[at - 1];
  const right = gradient.stops[at];
  if (left === undefined || right === undefined) return gradient;
  const color = `#${[1, 3, 5]
    .map(offset =>
      Math.round(
        (parseInt(left.color.slice(offset, offset + 2), 16) +
          parseInt(right.color.slice(offset, offset + 2), 16)) /
          2,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
  return {
    ...gradient,
    stops: [
      ...gradient.stops.slice(0, at),
      {color, position: (left.position + right.position) / 2},
      ...gradient.stops.slice(at),
    ],
  };
}
