import {expect, it} from 'vitest';
import {mediaObjectFit} from './objectFit';

it('maps every media fit value to its CSS object-fit value', () => {
  expect(mediaObjectFit('fit')).toBe('contain');
  expect(mediaObjectFit('fill')).toBe('cover');
  expect(mediaObjectFit('stretch')).toBe('fill');
});
