import {describe, expect, it} from 'vitest';
import {sliderKeyValue, sliderPercent} from './sliderValue';

const thumbnail = {min: 1, max: 5, step: 1};
const volume = {min: 0, max: 100, step: 1};

describe('sliderPercent', () => {
  it('places the value along the track', () => {
    expect(sliderPercent(1, thumbnail)).toBe(0);
    expect(sliderPercent(2, thumbnail)).toBe(25);
    expect(sliderPercent(5, thumbnail)).toBe(100);
  });

  it('stays on the track for values outside the range', () => {
    expect(sliderPercent(9, thumbnail)).toBe(100);
    expect(sliderPercent(-3, thumbnail)).toBe(0);
  });

  it('is empty for a range with no width', () => {
    expect(sliderPercent(3, {min: 3, max: 3, step: 1})).toBe(0);
  });
});

describe('sliderKeyValue', () => {
  it('moves at least one step on PageUp and PageDown', () => {
    expect(sliderKeyValue('PageUp', 2, thumbnail)).toBe(3);
    expect(sliderKeyValue('PageDown', 50, volume)).toBe(40);
  });

  it('goes to the ends with Home and End', () => {
    expect(sliderKeyValue('Home', 3, thumbnail)).toBe(1);
    expect(sliderKeyValue('End', 3, thumbnail)).toBe(5);
  });

  it('ignores other keys', () => {
    expect(sliderKeyValue('Enter', 3, thumbnail)).toBeUndefined();
  });
});
