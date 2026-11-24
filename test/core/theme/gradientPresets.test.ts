import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {
  GRADIENT_PRESETS,
  gradientNamed,
  isGradientPreset,
} from '@core/theme/gradientPresets';
import {slideBackgroundSchema} from '@core/schema/screens/theme';

describe('the gradient presets', () => {
  it('are each a slide background a theme file takes, with a name of its own', () => {
    for (const {gradient} of GRADIENT_PRESETS) {
      expect(v.safeParse(slideBackgroundSchema, gradient).success).toBe(true);
    }
    const names = GRADIENT_PRESETS.map(preset => preset.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds a preset by name and refuses a name that is not one', () => {
    expect(gradientNamed('청록').stops[0]?.color).toBe('#002E38');
    expect(() => gradientNamed('없는 색')).toThrow('No gradient 없는 색');
  });
});

describe('isGradientPreset', () => {
  const preset = gradientNamed('청록');

  it('matches the same angle and stops, whatever the letter case of a color', () => {
    const lower = {
      ...preset,
      stops: preset.stops.map(stop => ({
        ...stop,
        color: stop.color.toLowerCase(),
      })),
    };

    expect(isGradientPreset(lower, preset)).toBe(true);
  });

  it('does not match another angle, another stop or another count of stops', () => {
    expect(isGradientPreset({...preset, angle: 90}, preset)).toBe(false);
    expect(
      isGradientPreset(
        {
          ...preset,
          stops: [{color: '#000000', position: 0}, ...preset.stops.slice(1)],
        },
        preset,
      ),
    ).toBe(false);
    expect(
      isGradientPreset({...preset, stops: preset.stops.slice(0, 1)}, preset),
    ).toBe(false);
  });
});
