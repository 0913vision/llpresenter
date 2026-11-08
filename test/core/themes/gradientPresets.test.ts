import {expect, it} from 'vitest';
import * as v from 'valibot';
import {themeGradientSchema} from '@core/schema/themeBackground';
import {GRADIENT_PRESETS, isGradientPreset} from '@core/themes/gradientPresets';

it('keeps the chosen teal and approved presets in presentation order', () => {
  expect(
    GRADIENT_PRESETS.map(({name, gradient}) => ({name, stops: gradient.stops})),
  ).toEqual([
    {
      name: '청록',
      stops: [
        {
          position: 5,
          color: '#00222B',
        },
        {
          position: 100,
          color: '#00809A',
        },
      ],
    },
    {
      name: '적갈',
      stops: [
        {
          position: 0,
          color: '#3A0000',
        },
        {
          position: 50,
          color: '#5A2500',
        },
        {
          position: 100,
          color: '#7A4900',
        },
      ],
    },
    {
      name: '초록',
      stops: [
        {
          position: 0,
          color: '#003A24',
        },
        {
          position: 100,
          color: '#007A43',
        },
      ],
    },
    {
      name: '자주',
      stops: [
        {
          position: 0,
          color: '#3A002E',
        },
        {
          position: 100,
          color: '#AC00A0',
        },
      ],
    },
    {
      name: '청록초록',
      stops: [
        {
          position: 0,
          color: '#003A28',
        },
        {
          position: 100,
          color: '#008474',
        },
      ],
    },
    {
      name: '남보라',
      stops: [
        {
          position: 0,
          color: '#2C003A',
        },
        {
          position: 100,
          color: '#0073AC',
        },
      ],
    },
    {
      name: '올리브',
      stops: [
        {
          position: 0,
          color: '#3A1900',
        },
        {
          position: 50,
          color: '#5C4800',
        },
        {
          position: 100,
          color: '#7D7A00',
        },
      ],
    },
    {
      name: '연초록',
      stops: [
        {
          position: 0,
          color: '#567A40',
        },
        {
          position: 100,
          color: '#1F7D4E',
        },
      ],
    },
    {
      name: '새벽',
      stops: [
        {
          position: 20,
          color: '#141B3F',
        },
        {
          position: 95,
          color: '#4A2A78',
        },
      ],
    },
    {
      name: '노을',
      stops: [
        {
          position: 20,
          color: '#2E0A2C',
        },
        {
          position: 70,
          color: '#7A2238',
        },
        {
          position: 100,
          color: '#B0522A',
        },
      ],
    },
    {
      name: '바다',
      stops: [
        {
          position: 20,
          color: '#0A1F3F',
        },
        {
          position: 95,
          color: '#0F6470',
        },
      ],
    },
    {
      name: '밤하늘',
      stops: [
        {
          position: 10,
          color: '#070B18',
        },
        {
          position: 100,
          color: '#1C2856',
        },
      ],
    },
    {
      name: '성탄',
      stops: [
        {
          position: 20,
          color: '#0B3325',
        },
        {
          position: 95,
          color: '#6E0E1C',
        },
      ],
    },
    {
      name: '부활',
      stops: [
        {
          position: 20,
          color: '#261246',
        },
        {
          position: 95,
          color: '#8C6A22',
        },
      ],
    },
    {
      name: '성령',
      stops: [
        {
          position: 20,
          color: '#2E0606',
        },
        {
          position: 95,
          color: '#A8381A',
        },
      ],
    },
    {
      name: '은혜',
      stops: [
        {
          position: 20,
          color: '#1A222D',
        },
        {
          position: 95,
          color: '#465565',
        },
      ],
    },
    {
      name: '묵상',
      stops: [
        {
          position: 10,
          color: '#121212',
        },
        {
          position: 100,
          color: '#343434',
        },
      ],
    },
    {
      name: '감사',
      stops: [
        {
          position: 20,
          color: '#321F0E',
        },
        {
          position: 95,
          color: '#8E5E27',
        },
      ],
    },
    {
      name: '오로라',
      stops: [
        {
          position: 15,
          color: '#0A2433',
        },
        {
          position: 55,
          color: '#1F5E4A',
        },
        {
          position: 95,
          color: '#4A2F78',
        },
      ],
    },
  ]);
  for (const {gradient} of GRADIENT_PRESETS) {
    expect(v.safeParse(themeGradientSchema, gradient).success).toBe(true);
    expect(gradient.angle).toBe(135);
    expect(gradient.mixing).toBe('oklch');
  }
  expect(GRADIENT_PRESETS[4]?.gradient.stops[1]).toEqual({
    color: '#008474',
    position: 100,
  });
  expect(GRADIENT_PRESETS[1]?.gradient.stops[1]).toEqual({
    color: '#5A2500',
    position: 50,
  });
  expect(GRADIENT_PRESETS[6]?.gradient.stops[1]).toEqual({
    color: '#5C4800',
    position: 50,
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
