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

/** Inserts a sampled color at a point, after any existing hard edge there. */
export function addGradientStop(
  gradient: ThemeGradient,
  position: number,
  color: string,
): {gradient: ThemeGradient; index: number} {
  if (gradient.stops.length >= THEME_BACKGROUND_LIMITS.stops) {
    return {gradient, index: 0};
  }
  const stop = {color, position: boundedPosition(position)};
  const next = gradient.stops.findIndex(
    value => value.position > stop.position,
  );
  const index = next < 0 ? gradient.stops.length : next;
  return {
    gradient: {
      ...gradient,
      stops: [
        ...gradient.stops.slice(0, index),
        stop,
        ...gradient.stops.slice(index),
      ],
    },
    index,
  };
}

function boundedPosition(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Moves one stop across its neighbors, retaining its color and extension fields. */
export function moveGradientStop(
  gradient: ThemeGradient,
  index: number,
  position: number,
): {gradient: ThemeGradient; index: number} {
  const previous = gradient.stops[index];
  if (previous === undefined) return {gradient, index};
  const stop = {...previous, position: boundedPosition(position)};
  if (stop.position === previous.position) return {gradient, index};
  const stops = gradient.stops.map((value, at) =>
    at === index ? stop : value,
  );
  stops.sort((left, right) => left.position - right.position);
  return {gradient: {...gradient, stops}, index: stops.indexOf(stop)};
}

/** Removes a selected stop while retaining at least two colors. */
export function removeGradientStop(
  gradient: ThemeGradient,
  index: number,
): ThemeGradient {
  return gradient.stops.length <= 2 || gradient.stops[index] === undefined
    ? gradient
    : {...gradient, stops: gradient.stops.filter((_, at) => at !== index)};
}
