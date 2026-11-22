import {shownText} from '@fixtures/core/liveSlide';
import {describe, expect, it} from 'vitest';
import {hasSomethingToClear} from '@core/live/clear';
import {emptyLayers} from '@core/live/state';

const slide = {itemId: 'song', position: 0, ...shownText(['가사'])};

describe('hasSomethingToClear', () => {
  it('checks one layer, and any layer for all', () => {
    const layers = {...emptyLayers(), slide};

    expect(hasSomethingToClear(layers, 'slide')).toBe(true);
    expect(hasSomethingToClear(layers, 'media')).toBe(false);
    expect(hasSomethingToClear(layers, 'all')).toBe(true);
    expect(hasSomethingToClear(emptyLayers(), 'all')).toBe(false);
  });
});
