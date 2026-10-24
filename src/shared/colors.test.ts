import {describe, expect, it} from 'vitest';
import {
  isLabelColor,
  isMacroColor,
  isPaletteColor,
  paletteColors,
} from './colors';

describe('palette colors', () => {
  it('has the eight colors of the label-* tokens', () => {
    expect(paletteColors).toEqual([
      'teal',
      'green',
      'yellow',
      'orange',
      'rose',
      'violet',
      'slate',
      'gray',
    ]);
  });

  it('accepts only palette names', () => {
    expect(paletteColors.every(isPaletteColor)).toBe(true);
    for (const value of ['none', 'red', 'Teal', '', null, undefined, 3, {}]) {
      expect(isPaletteColor(value)).toBe(false);
    }
  });
});

describe('isLabelColor', () => {
  it('accepts the palette and none', () => {
    expect(isLabelColor('none')).toBe(true);
    expect(isLabelColor('rose')).toBe(true);
    expect(isLabelColor('red')).toBe(false);
    expect(isLabelColor(null)).toBe(false);
  });
});

describe('isMacroColor', () => {
  it('rejects none, because macro tiles always have a color', () => {
    expect(isMacroColor('none')).toBe(false);
    expect(isMacroColor('violet')).toBe(true);
  });
});
