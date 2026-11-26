import {describe, expect, it} from 'vitest';
import type {GradientBackground} from '@core/theme';
import {
  backgroundColorOf,
  themeGradientColorAt,
} from '@renderer/rendering/theme/themeBackground';

const gradient: GradientBackground = {
  kind: 'gradient',
  angle: 135,
  stops: [
    {color: '#1E2761', position: 20},
    {color: '#808080', position: 50},
    {color: '#F96167', position: 50},
    {color: '#FFFFFF', position: 80},
  ],
};

describe('themeGradientColorAt', () => {
  it('takes the first color before the first stop and the last after the last', () => {
    expect(themeGradientColorAt(gradient, 0)).toBe('#1E2761');
    expect(themeGradientColorAt(gradient, 100)).toBe('#FFFFFF');
  });

  it('mixes the two stops around a place by its distance from each', () => {
    expect(themeGradientColorAt(gradient, 35)).toBe(
      'color-mix(in oklch shorter hue, #1E2761 50%, oklch(from #808080 l max(c, 0.0001) none) 50%)',
    );
  });

  it('turns at once at a hard edge, two stops at one place', () => {
    expect(themeGradientColorAt(gradient, 50)).toContain('#F96167 100%');
  });

  it('draws black for a gradient with no stops', () => {
    expect(themeGradientColorAt({...gradient, stops: []}, 10)).toBe('#000000');
  });
});

describe('backgroundColorOf', () => {
  it('lays a color or the first color of a gradient under a background, and nothing under a picture', () => {
    expect(backgroundColorOf({kind: 'color', color: '#112233'})).toBe(
      '#112233',
    );
    expect(backgroundColorOf(gradient)).toBe('#1E2761');
    expect(backgroundColorOf(undefined)).toBeUndefined();
  });
});
