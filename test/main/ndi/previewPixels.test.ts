import {expect, it} from 'vitest';
import {previewPixels} from '../../../src/main/ndi/previewPixels.cjs';

it('downsamples a received BGRA frame while retaining color and alpha', () => {
  const source = new Uint8Array([
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
  ]);
  const result = previewPixels(source, 2, 2, 8);
  expect([...result.subarray(0, 4)]).toEqual([30, 20, 10, 40]);
  expect([...result.subarray(639 * 4, 640 * 4)]).toEqual([70, 60, 50, 80]);
  expect([...result.subarray(359 * 640 * 4, (359 * 640 + 1) * 4)]).toEqual([
    110, 100, 90, 120,
  ]);
  expect([...result.subarray(-4)]).toEqual([150, 140, 130, 160]);
  expect(previewPixels(source, 2, 2, 8, false)[3]).toBe(255);
});
