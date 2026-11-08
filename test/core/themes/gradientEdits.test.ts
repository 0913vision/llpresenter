import {expect, it} from 'vitest';
import * as v from 'valibot';
import {addGradientStop, createThemeGradient} from '@core/themes/gradientEdits';
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

it('creates new gradients in OKLCH and preserves the chosen starting color', () => {
  const created = createThemeGradient('#00303A');
  expect(created.mixing).toBe('oklch');
  expect(created.stops[0]?.color).toBe('#00303A');
  expect(v.safeParse(themeGradientSchema, created).success).toBe(true);
});

it('adds a midpoint in the widest interval without moving existing stops and caps at four', () => {
  const three = addGradientStop(gradient);
  expect(three.stops).toEqual([
    {color: '#000000', position: 0},
    {color: '#808080', position: 50},
    {color: '#FFFFFF', position: 100},
  ]);
  const four = addGradientStop(three);
  expect(four.stops.map(stop => stop.position)).toEqual([0, 25, 50, 100]);
  expect(v.safeParse(themeGradientSchema, four).success).toBe(true);
  expect(addGradientStop(four)).toBe(four);
  expect(gradient.stops).toHaveLength(2);
});

it('keeps hard-stop positions sorted when there is no positive interval', () => {
  const result = addGradientStop({
    ...gradient,
    stops: gradient.stops.map(stop => ({...stop, position: 50})),
  });
  expect(result.stops.map(stop => stop.position)).toEqual([50, 50, 50]);
  expect(v.safeParse(themeGradientSchema, result).success).toBe(true);
});
