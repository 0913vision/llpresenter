import {describe, expect, it} from 'vitest';
import {
  fitAfter,
  sizeSteps,
} from '@renderer/features/screens/themes/properties/themeTextFit';

describe('sizeSteps', () => {
  it('keeps the typed sizes largest first, each once, since the first that fits is drawn', () => {
    expect(sizeSteps('60, 80, 70, 80')).toEqual([80, 70, 60]);
  });

  it('takes only font sizes, at most 8, and none from an empty field', () => {
    expect(sizeSteps('500, 90, 8, 글자, , 72.5')).toEqual([90, 72.5]);
    expect(sizeSteps('20, 30, 40, 50, 60, 70, 80, 90, 100, 110')).toEqual([
      110, 100, 90, 80, 70, 60, 50, 40,
    ]);
    expect(sizeSteps('')).toBeUndefined();
    expect(sizeSteps(' , 3')).toBeUndefined();
  });
});

describe('fitAfter', () => {
  it('adds and changes settings, and leaves out the ones turned off', () => {
    expect(fitAfter(undefined, {rows: 2})).toEqual({rows: 2});
    expect(fitAfter({rows: 2, keepRows: true}, {keepRows: false})).toEqual({
      rows: 2,
    });
    expect(fitAfter({rows: 2}, {sizes: [90, 80], min: undefined})).toEqual({
      rows: 2,
      sizes: [90, 80],
    });
  });

  it('gives no settings once the last one is turned off', () => {
    expect(fitAfter({together: true}, {together: false})).toBeUndefined();
    expect(fitAfter({sizes: [90]}, {sizes: undefined})).toBeUndefined();
  });
});
