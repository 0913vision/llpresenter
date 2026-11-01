import {describe, expect, it} from 'vitest';
import {createItemOverlayId} from '../schema/ids';
import type {ItemOverlay} from '../schema/itemOverlays';
import {itemOverlayRow} from './itemOverlayRows';

const ranges: readonly ItemOverlay[] = [
  {from: 2, to: 4},
  {from: 5, to: 6},
  {from: 7, to: 7},
].map((range, index) => ({
  ...range,
  id: createItemOverlayId(`77000000-0000-4000-8000-00000000000${index}`),
  name: `Range ${index + 1}`,
  screens: [],
  content: {text: 'Invented caption'},
}));

describe('item overlay rows', () => {
  it('maps inclusive ranges to zero-based rows with distinct adjacent edges', () => {
    expect(
      Array.from({length: 8}, (_, index) => itemOverlayRow(ranges, index)),
    ).toEqual([
      undefined,
      {overlay: ranges[0], start: true, end: false},
      {overlay: ranges[0], start: false, end: false},
      {overlay: ranges[0], start: false, end: true},
      {overlay: ranges[1], start: true, end: false},
      {overlay: ranges[1], start: false, end: true},
      {overlay: ranges[2], start: true, end: true},
      undefined,
    ]);
  });

  it('leaves a row without an overlay when there are no ranges', () => {
    expect(itemOverlayRow([], 0)).toBeUndefined();
  });
});
