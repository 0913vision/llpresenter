import {expect, it} from 'vitest';
import {isLyricTextColor} from '@core/schema/textStyle';

it('recognizes only six-digit hex text colors', () => {
  expect(isLyricTextColor('#aAbBcC')).toBe(true);
  expect(isLyricTextColor('#fff')).toBe(false);
  expect(isLyricTextColor('red')).toBe(false);
});
