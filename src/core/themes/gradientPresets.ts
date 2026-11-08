import type {ThemeGradient} from '../schema/themeBackground';

interface GradientPreset {
  readonly name: string;
  readonly gradient: ThemeGradient;
}

/** The approved church palette, in presentation order. */
export const GRADIENT_PRESETS: readonly GradientPreset[] = (
  [
    {
      name: '청록',
      stops: [
        [36, '#00303A'],
        [87, '#00667A'],
      ],
    },
    {
      name: '적갈',
      stops: [
        [36, '#3A0000'],
        [61.5, '#5A2500'],
        [87, '#7A4900'],
      ],
    },
    {
      name: '초록',
      stops: [
        [36, '#003A24'],
        [87, '#007A43'],
      ],
    },
    {
      name: '자주',
      stops: [
        [36, '#3A002E'],
        [87, '#AC00A0'],
      ],
    },
    {
      name: '청록초록',
      stops: [
        [36, '#003A28'],
        [87, '#008474'],
      ],
    },
    {
      name: '남보라',
      stops: [
        [36, '#2C003A'],
        [87, '#0073AC'],
      ],
    },
    {
      name: '올리브',
      stops: [
        [36, '#3A1900'],
        [61.5, '#5C4800'],
        [87, '#7D7A00'],
      ],
    },
    {
      name: '연초록',
      stops: [
        [36, '#7A9F5A'],
        [67, '#30A26A'],
      ],
    },
  ] as const
).map<GradientPreset>(({name, stops}) => ({
  name,
  gradient: {
    kind: 'linear',
    angle: 135,
    mixing: 'oklch',
    stops: stops.map(([position, color]) => ({position, color})),
  },
}));

/** Compares visible values; unknown file extensions do not affect selection. */
export function isGradientPreset(
  gradient: ThemeGradient,
  preset: ThemeGradient,
): boolean {
  return (
    gradient.angle === preset.angle &&
    gradient.stops.length === preset.stops.length &&
    gradient.stops.every((stop, index) => {
      const other = preset.stops[index];
      return (
        stop.position === other?.position &&
        stop.color.toUpperCase() === other.color.toUpperCase()
      );
    })
  );
}
