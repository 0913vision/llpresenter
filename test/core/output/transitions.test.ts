import {describe, expect, it} from 'vitest';
import {
  DEFAULT_TRANSITION_TIMES,
  transitionTimes,
} from '@core/output/transitions';
import {defaultPreferences} from '@core/schema/preferences';

function withTransition(
  slide: {kind: 'none' | 'dissolve'; seconds: number},
  media: {kind: 'none' | 'dissolve'; seconds: number},
) {
  return {output: {transition: {slide, media}}};
}

describe('transitionTimes', () => {
  it('reads the defaults as the old fixed 200 ms and 500 ms', () => {
    expect(transitionTimes(defaultPreferences)).toEqual(
      DEFAULT_TRANSITION_TIMES,
    );
    expect(DEFAULT_TRANSITION_TIMES).toEqual({slideMs: 200, backgroundMs: 500});
  });

  it('turns seconds into milliseconds for a dissolve', () => {
    expect(
      transitionTimes(
        withTransition(
          {kind: 'dissolve', seconds: 1.5},
          {kind: 'dissolve', seconds: 3},
        ),
      ),
    ).toEqual({slideMs: 1500, backgroundMs: 3000});
  });

  it('makes 없음 a cut whatever the seconds are, each part on its own', () => {
    expect(
      transitionTimes(
        withTransition(
          {kind: 'none', seconds: 1},
          {kind: 'dissolve', seconds: 0.1},
        ),
      ),
    ).toEqual({slideMs: 0, backgroundMs: 100});
  });
});
