import {expect, it} from 'vitest';
import * as v from 'valibot';
import {themeGradientSchema} from '@core/schema/themeBackground';
import {GRADIENT_PRESETS, isGradientPreset} from '@core/themes/gradientPresets';

it('keeps the approved palette in presentation order, including the darker teal-green', () => {
  expect(GRADIENT_PRESETS.map(preset => preset.name)).toEqual([
    '청록',
    '적갈',
    '초록',
    '자주',
    '청록초록',
    '남보라',
    '올리브',
    '연초록',
  ]);
  for (const {gradient} of GRADIENT_PRESETS) {
    expect(v.safeParse(themeGradientSchema, gradient).success).toBe(true);
    expect(gradient.angle).toBe(135);
    expect(gradient.mixing).toBe('oklch');
  }
  expect(GRADIENT_PRESETS[4]?.gradient.stops[1]).toEqual({
    color: '#008474',
    position: 87,
  });
  expect(GRADIENT_PRESETS[1]?.gradient.stops[1]).toEqual({
    color: '#5A2500',
    position: 61.5,
  });
  expect(GRADIENT_PRESETS[6]?.gradient.stops[1]).toEqual({
    color: '#5C4800',
    position: 61.5,
  });
});

it('selects matching visible values regardless of hex case and extensions', () => {
  const preset = GRADIENT_PRESETS[1]?.gradient;
  if (preset === undefined) throw new Error('Missing preset');
  const extended = {
    ...preset,
    future: true,
    stops: preset.stops.map(stop => ({
      ...stop,
      color: stop.color.toLowerCase(),
    })),
  };
  expect(isGradientPreset(extended, preset)).toBe(true);
  expect(isGradientPreset({...preset, angle: 0}, preset)).toBe(false);
  expect(
    isGradientPreset({...preset, stops: preset.stops.slice(1)}, preset),
  ).toBe(false);
});
