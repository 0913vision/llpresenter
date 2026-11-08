import type {ThemeGradient} from '../schema/themeBackground';

interface GradientPreset {
  readonly name: string;
  readonly gradient: ThemeGradient;
}

/** The approved church and extra gradients, in presentation order. */
export const GRADIENT_PRESETS: readonly GradientPreset[] = (
  [
    {
      name: '청록',
      stops: [
        [0, '#002E38'],
        [100, '#00768C'],
      ],
    },
    {
      name: '적갈',
      stops: [
        [0, '#3A0000'],
        [50, '#5A2500'],
        [100, '#7A4900'],
      ],
    },
    {
      name: '초록',
      stops: [
        [0, '#13452C'],
        [100, '#3B8440'],
      ],
    },
    {
      name: '자주',
      stops: [
        [0, '#3A002E'],
        [100, '#AC00A0'],
      ],
    },
    {
      name: '청록초록',
      stops: [
        [0, '#003A28'],
        [100, '#008474'],
      ],
    },
    {
      name: '남보라',
      stops: [
        [0, '#2C003A'],
        [100, '#0073AC'],
      ],
    },
    {
      name: '올리브',
      stops: [
        [0, '#3A1900'],
        [50, '#5C4800'],
        [100, '#7D7A00'],
      ],
    },
    {
      name: '연초록',
      stops: [
        [0, '#567A40'],
        [100, '#1F7D4E'],
      ],
    },
    {
      name: '새벽',
      stops: [
        [20, '#141B3F'],
        [95, '#4A2A78'],
      ],
    },
    {
      name: '노을',
      stops: [
        [20, '#2E0A2C'],
        [70, '#7A2238'],
        [100, '#B0522A'],
      ],
    },
    {
      name: '바다',
      stops: [
        [20, '#0A1F3F'],
        [95, '#0F6470'],
      ],
    },
    {
      name: '밤하늘',
      stops: [
        [10, '#070B18'],
        [100, '#1C2856'],
      ],
    },
    {
      name: '성탄',
      stops: [
        [20, '#0B3325'],
        [95, '#6E0E1C'],
      ],
    },
    {
      name: '부활',
      stops: [
        [20, '#261246'],
        [95, '#8C6A22'],
      ],
    },
    {
      name: '성령',
      stops: [
        [20, '#2E0606'],
        [95, '#A8381A'],
      ],
    },
    {
      name: '은혜',
      stops: [
        [20, '#1A222D'],
        [95, '#465565'],
      ],
    },
    {
      name: '묵상',
      stops: [
        [10, '#121212'],
        [100, '#343434'],
      ],
    },
    {
      name: '감사',
      stops: [
        [20, '#321F0E'],
        [95, '#8E5E27'],
      ],
    },
    {
      name: '오로라',
      stops: [
        [15, '#0A2433'],
        [55, '#1F5E4A'],
        [95, '#4A2F78'],
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
