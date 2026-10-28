import {expect, it} from 'vitest';
import {hexFromHsv, hsvFromHex} from './colorConversion';

it('round-trips representative channels through the color picker without drift', () => {
  for (const red of [0, 1, 16, 64, 127, 128, 192, 254, 255]) {
    for (const green of [0, 1, 16, 64, 127, 128, 192, 254, 255]) {
      for (const blue of [0, 1, 16, 64, 127, 128, 192, 254, 255]) {
        const hex = `#${[red, green, blue]
          .map(value => value.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()}`;
        expect(hexFromHsv(hsvFromHex(hex))).toBe(hex);
      }
    }
  }
});

it.each([
  {hue: 0, saturation: 100, value: 100, hex: '#FF0000'},
  {hue: 120, saturation: 100, value: 100, hex: '#00FF00'},
  {hue: 240, saturation: 100, value: 100, hex: '#0000FF'},
  {hue: 360, saturation: 100, value: 100, hex: '#FF0000'},
  {hue: 200, saturation: 0, value: 100, hex: '#FFFFFF'},
  {hue: 200, saturation: 100, value: 0, hex: '#000000'},
])(
  'converts hue $hue with saturation $saturation and value $value',
  ({hex, ...color}) => {
    expect(hexFromHsv(color)).toBe(hex);
  },
);
