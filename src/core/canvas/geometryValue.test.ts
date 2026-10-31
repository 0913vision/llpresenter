import {expect, it} from 'vitest';
import {
  formatGeometryValue,
  roundGeometryFrame,
  roundGeometryValue,
} from './geometryValue';

it.each([
  [115.19999999999999, '115.2'],
  [1689.6000000000001, '1689.6'],
  [64.8, '64.8'],
  [20, '20'],
  [1.24, '1.2'],
  [1.25, '1.3'],
  [-1.26, '-1.3'],
  [-1.25, '-1.2'],
  [-0.01, '0'],
  [-0, '0'],
])('formats %s as %s at one decimal without trailing zeroes', (value, text) => {
  expect(formatGeometryValue(value)).toBe(text);
  expect(roundGeometryValue(value)).toBe(Number(text));
});

it('rounds a gesture frame while preserving metadata and stable references', () => {
  const frame = {x: 115.253, y: -23.456, w: 500.05, h: 99.99, future: 1};
  const rounded = roundGeometryFrame(frame);
  expect(rounded).toEqual({x: 115.3, y: -23.5, w: 500.1, h: 100, future: 1});
  expect(roundGeometryFrame(rounded)).toBe(rounded);
});
