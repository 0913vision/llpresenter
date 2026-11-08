import {expect, it} from 'vitest';
import {
  themeBackgroundColor,
  themeBackgroundStyle,
} from '@renderer/rendering/themeBackground';
import type {ThemeGradient} from '@core/schema/themeBackground';

const gradient: ThemeGradient = {
  kind: 'linear',
  angle: 135,
  mixing: 'oklch',
  stops: [
    {color: '#00303A', position: 36},
    {color: '#00667A', position: 87},
  ],
};

it.each([
  [0, 90],
  [90, 180],
  [135, 225],
  [359, 89],
])('maps clockwise PowerPoint angle %i to CSS %i', (angle, css) => {
  expect(themeBackgroundStyle({...gradient, angle}).backgroundImage).toContain(
    `linear-gradient(${css}deg in oklch shorter hue, #00303A 36%, #00667A 87%)`,
  );
});

it('always uses the short OKLCH hue path with a static dither tile', () => {
  const style = themeBackgroundStyle(gradient);
  expect(style.backgroundImage).toContain('in oklch shorter hue,');
  expect(style.backgroundImage).toContain('data:image/svg+xml,');
});

it('borrows the adjacent hue for neutral and near-neutral endpoints', () => {
  for (const color of ['#808080', '#808081', '#FFFFFF']) {
    const style = themeBackgroundStyle({
      ...gradient,
      stops: [
        {color, position: 0},
        {color: '#FF0000', position: 100},
      ],
    });
    expect(style.backgroundImage).toContain(
      `oklch(from ${color} l max(c, 0.0001) none) 0%`,
    );
    expect(style.backgroundImage).toContain('#FF0000 100%');
  }
});

it('removes the gradient image on inheritance or a legacy solid without retaining noise', () => {
  expect(themeBackgroundStyle(undefined, '#00B140')).toMatchObject({
    backgroundColor: '#00B140',
    backgroundImage: 'none',
  });
  expect(themeBackgroundStyle('#112233', '#00B140')).toMatchObject({
    backgroundColor: '#112233',
    backgroundImage: 'none',
  });
  expect(themeBackgroundColor(gradient, '#00B140')).toBe('#00303A');
});
