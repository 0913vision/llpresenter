import {describe, expect, it} from 'vitest';
import {emptyLiveState, isAnyOutputOn} from '@core/live/state';
import {MAIN_SCREEN, STAGE_SCREEN} from '@fixtures/core/screenIds';

describe('isAnyOutputOn', () => {
  it('is true only while a screen output is on', () => {
    const state = emptyLiveState();

    expect(isAnyOutputOn(state)).toBe(false);
    expect(isAnyOutputOn({...state, outputs: {[MAIN_SCREEN]: false}})).toBe(
      false,
    );
    expect(
      isAnyOutputOn({
        ...state,
        outputs: {[MAIN_SCREEN]: false, [STAGE_SCREEN]: true},
      }),
    ).toBe(true);
  });
});
