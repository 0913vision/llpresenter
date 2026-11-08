import {expect, it} from 'vitest';
import * as v from 'valibot';
import {
  addGradientStop,
  createThemeGradient,
  moveGradientStop,
  removeGradientStop,
} from '@core/themes/gradientEdits';
import {
  themeGradientSchema,
  type ThemeGradient,
} from '@core/schema/themeBackground';

const gradient: ThemeGradient = {
  kind: 'linear',
  angle: 0,
  mixing: 'oklch',
  stops: [
    {color: '#000000', position: 0},
    {color: '#FFFFFF', position: 100},
  ],
};

it('starts in OKLCH with the chosen color', () => {
  const created = createThemeGradient('#00303A');
  expect(created.mixing).toBe('oklch');
  expect(created.stops[0]?.color).toBe('#00303A');
  expect(v.safeParse(themeGradientSchema, created).success).toBe(true);
});

it('inserts a sampled color at the requested position, selects it, and caps at four', () => {
  const three = addGradientStop(gradient, 75.5, '#AEAEAE');
  expect(three.index).toBe(1);
  expect(three.gradient.stops[1]).toEqual({color: '#AEAEAE', position: 75.5});
  const four = addGradientStop(three.gradient, 25, '#222222');
  expect(four.index).toBe(1);
  expect(four.gradient.stops.map(stop => stop.position)).toEqual([
    0, 25, 75.5, 100,
  ]);
  expect(v.safeParse(themeGradientSchema, four.gradient).success).toBe(true);
  expect(addGradientStop(four.gradient, 50, '#636363').gradient).toBe(
    four.gradient,
  );
  expect(gradient.stops).toHaveLength(2);
});

it('orders a moving stop across neighbors, preserving its extensions and clamping to the ends', () => {
  const three = addGradientStop(gradient, 50, '#636363').gradient;
  const extended = {
    ...three,
    stops: three.stops.map((stop, index) =>
      index === 0 ? {...stop, future: true} : stop,
    ),
  };
  const moved = moveGradientStop(extended, 0, 80);
  expect(moved.index).toBe(1);
  expect(moved.gradient.stops.map(stop => stop.position)).toEqual([
    50, 80, 100,
  ]);
  expect(moved.gradient.stops[1]).toMatchObject({
    color: '#000000',
    future: true,
  });
  expect(
    moveGradientStop(moved.gradient, 1, 200).gradient.stops.at(-1)?.position,
  ).toBe(100);
  expect(
    moveGradientStop(moved.gradient, 1, -20).gradient.stops[0]?.position,
  ).toBe(0);
  expect(extended.stops[0]?.position).toBe(0);
});

it('inserts after tied stops and never deletes below two', () => {
  const tied = {
    ...gradient,
    stops: gradient.stops.map(stop => ({...stop, position: 50})),
  };
  const added = addGradientStop(tied, 50, '#636363');
  expect(added.index).toBe(2);
  expect(added.gradient.stops.map(stop => stop.position)).toEqual([50, 50, 50]);
  expect(removeGradientStop(added.gradient, 1).stops).toHaveLength(2);
  expect(removeGradientStop(gradient, 0)).toBe(gradient);
});
