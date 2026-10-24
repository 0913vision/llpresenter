import {describe, expect, it} from 'vitest';
import {defaultColumns, sizeClassFor} from './sizeClass';

const MIN_WINDOW_WIDTH = 1280;
const CENTER_MIN_WIDTH = 560;
const PANEL_GAP = 4;
const GAPS_ACROSS_COLUMNS = 4;

describe('sizeClassFor', () => {
  it('switches classes at the boundaries', () => {
    expect(sizeClassFor(1280)).toBe('narrow');
    expect(sizeClassFor(1536)).toBe('narrow');
    expect(sizeClassFor(1599)).toBe('narrow');
    expect(sizeClassFor(1600)).toBe('normal');
    expect(sizeClassFor(1920)).toBe('normal');
    expect(sizeClassFor(2399)).toBe('normal');
    expect(sizeClassFor(2400)).toBe('wide');
    expect(sizeClassFor(2560)).toBe('wide');
  });

  it('leaves the center column its minimum width in the smallest window', () => {
    const {left, right} = defaultColumns.narrow;
    const center =
      MIN_WINDOW_WIDTH - left - right - PANEL_GAP * GAPS_ACROSS_COLUMNS;
    expect(center).toBeGreaterThanOrEqual(CENTER_MIN_WIDTH);
  });
});
