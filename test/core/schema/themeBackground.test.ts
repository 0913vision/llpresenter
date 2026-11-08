import {expect, it} from 'vitest';
import * as v from 'valibot';
import {
  themeBackgroundSchema,
  type ThemeGradient,
} from '@core/schema/themeBackground';
import {
  parseThemes,
  serializeThemes,
  themeScreenLayoutSchema,
} from '@core/schema/themes';
import {liveThemeOutputSchema} from '@core/schema/liveTheme';
import {createDefaultThemes} from '@core/themes/defaults';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const gradient: ThemeGradient = {
  kind: 'linear',
  angle: 135,
  mixing: 'oklch',
  stops: [
    {color: '#00303A', position: 36},
    {color: '#00667A', position: 87},
  ],
};
const layout = {mode: {kind: 'own'}, elements: []};
const id = '00000000-0000-4000-8000-000000000001';

it.each([
  [
    'teal',
    [
      [36, '#00303A'],
      [87, '#00667A'],
    ],
  ],
  [
    'redbrown',
    [
      [36, '#3A0000'],
      [61.5, '#5A2500'],
      [87, '#7A4900'],
    ],
  ],
  [
    'green',
    [
      [36, '#003A24'],
      [87, '#007A43'],
    ],
  ],
  [
    'magenta',
    [
      [36, '#3A002E'],
      [87, '#AC00A0'],
    ],
  ],
  [
    'tealgreen',
    [
      [36, '#003A28'],
      [87, '#00AC98'],
    ],
  ],
  [
    'bluepurple',
    [
      [36, '#2C003A'],
      [87, '#0073AC'],
    ],
  ],
  [
    'olive',
    [
      [36, '#3A1900'],
      [61.5, '#5C4800'],
      [87, '#7D7A00'],
    ],
  ],
  [
    'lightgreen',
    [
      [36, '#7A9F5A'],
      [67, '#30A26A'],
    ],
  ],
] as const)('accepts the exact %s Sunday reference stops', (_name, stops) => {
  expect(
    v.safeParse(themeBackgroundSchema, {
      ...gradient,
      stops: stops.map(([position, color]) => ({position, color})),
    }).success,
  ).toBe(true);
});

it('keeps legacy solids and inheritance and bounds the fixed OKLCH gradient', () => {
  expect(v.safeParse(themeScreenLayoutSchema, layout).success).toBe(true);
  expect(v.safeParse(themeBackgroundSchema, '#1234ab').success).toBe(true);
  for (const angle of [0, 135, 359]) {
    expect(
      v.safeParse(themeBackgroundSchema, {
        ...gradient,
        angle,
        stops: [
          {color: '#000000', position: 0},
          {color: '#123456', position: 25.5},
          {color: '#654321', position: 25.5},
          {color: '#FFFFFF', position: 100},
        ],
      }).success,
    ).toBe(true);
  }
  expect(
    v.safeParse(themeScreenLayoutSchema, {...layout, background: undefined})
      .success,
  ).toBe(false);
});

it.each([
  {kind: 'radial'},
  {angle: -1},
  {angle: 360},
  {angle: 12.5},
  {angle: Infinity},
  {angle: NaN},
  {mixing: 'rgb'},
  {mixing: 'srgb'},
  {mixing: 'oklab'},
  {stops: []},
  {stops: [gradient.stops[0]]},
  {
    stops: Array.from({length: 5}, (_, position) => ({
      color: '#000000',
      position,
    })),
  },
  ...[-1, 101, Infinity, NaN].map(position => ({
    stops: [
      {color: '#000000', position},
      {color: '#FFFFFF', position: 100},
    ],
  })),
  {
    stops: [
      {color: '#000000', position: 90},
      {color: '#FFFFFF', position: 50},
    ],
  },
  {
    stops: [
      {color: '#000', position: 0},
      {color: '#FFFFFF', position: 100},
    ],
  },
  {
    stops: [
      {color: 'red', position: 0},
      {color: '#FFFFFF', position: 100},
    ],
  },
  {stops: [{color: '#000000'}, {color: '#FFFFFF', position: 100}]},
])('rejects invalid or unbounded gradient fields %j', patch => {
  expect(
    v.safeParse(themeBackgroundSchema, {...gradient, ...patch}).success,
  ).toBe(false);
});

it('validates gradients in the live output contract as well as settings', () => {
  const output = {
    themeId: id,
    revision: 0,
    missing: [],
    screens: {
      [id]: {
        sourceScreenId: id,
        emptyColor: '#000000',
        layout: {...layout, background: gradient},
      },
    },
  };
  expect(v.safeParse(liveThemeOutputSchema, output).success).toBe(true);
  expect(
    v.safeParse(liveThemeOutputSchema, {
      ...output,
      screens: {
        [id]: {
          ...output.screens[id],
          layout: {...layout, background: {...gradient, angle: 360}},
        },
      },
    }).success,
  ).toBe(false);
});

it('round-trips old colors and unknown gradient and stop extensions without a migration', () => {
  const file = createDefaultThemes();
  const data = {
    ...file,
    standby: {
      ...file.standby,
      screens: {
        [id]: {
          ...layout,
          background: {
            ...gradient,
            future: {kept: true},
            stops: gradient.stops.map(stop => ({...stop, future: 'kept'})),
          },
        },
      },
    },
  };
  const parsed = expectSuccess(
    parseThemes(JSON.stringify(data), 'themes.json'),
  );
  expect(parsed.access).toBe('editable');
  expect(
    JSON.parse(expectSuccess(serializeThemes(parsed.data, 'themes.json'))),
  ).toEqual(data);
});
