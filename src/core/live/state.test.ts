import {describe, expect, it} from 'vitest';
import {emptyLiveState, isAnyOutputOn} from './state';

describe('isAnyOutputOn', () => {
  it('is true only while a screen output is on', () => {
    const state = emptyLiveState();

    expect(isAnyOutputOn(state)).toBe(false);
    expect(isAnyOutputOn({...state, outputs: {main: false}})).toBe(false);
    expect(isAnyOutputOn({...state, outputs: {main: false, stage: true}})).toBe(
      true,
    );
  });
});
