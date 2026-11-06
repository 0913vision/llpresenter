import {expect, it} from 'vitest';
import {colorToHsv, hsvToColor} from '@core/labels/colorSpace';
import type {LabelColor} from '@core/labels/colors';

it.each<LabelColor>([
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#000000',
  '#FFFFFF',
  '#5FB8C2',
  '#123456',
])('round trips %s through HSV', color => {
  expect(hsvToColor(colorToHsv(color))).toBe(color);
});

it('starts an uncolored label at saturated red and preserves hue endpoints', () => {
  expect(colorToHsv('none')).toEqual({
    hue: 0,
    saturation: 100,
    brightness: 100,
  });
  expect(hsvToColor({hue: 360, saturation: 100, brightness: 100})).toBe(
    '#FF0000',
  );
});
