import {expect, it} from 'vitest';
import {isLyricTextColor, parseLyricTextStyle} from './textStyle';

const style = {
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  lineHeight: 1.4,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 6,
  shadow: true,
  outline: false,
};

it('validates all saved lyric text fields', () => {
  expect(parseLyricTextStyle(style)).toEqual(style);
  expect(parseLyricTextStyle({...style, size: 0})).toBeUndefined();
  expect(parseLyricTextStyle({...style, margin: 101})).toBeUndefined();
  expect(parseLyricTextStyle({...style, font: undefined})).toBeUndefined();
});

it('recognizes only six-digit hex text colors', () => {
  expect(isLyricTextColor('#aAbBcC')).toBe(true);
  expect(isLyricTextColor('#fff')).toBe(false);
  expect(isLyricTextColor('red')).toBe(false);
});
