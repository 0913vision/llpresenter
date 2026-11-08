import {describe, expect, it} from 'vitest';
import {
  DEFAULT_TRANSITION_TIMES,
  transitionTimes,
  slideTransitionFor,
} from '@core/output/transitions';
import {defaultPreferences} from '@core/schema/preferences';

function withTransition(
  slide: {kind: 'none' | 'dissolve'; sec: number},
  media: {kind: 'none' | 'dissolve'; seconds: number},
) {
  return {
    output: {
      transition: {
        between: slide,
        within: defaultPreferences.output.transition.within,
        media,
      },
    },
  };
}

describe('transitionTimes', () => {
  it('reads the defaults as the 500 ms between items and for backgrounds', () => {
    expect(transitionTimes(defaultPreferences)).toEqual(
      DEFAULT_TRANSITION_TIMES,
    );
    expect(DEFAULT_TRANSITION_TIMES).toEqual({slideMs: 500, backgroundMs: 500});
  });

  it('turns seconds into milliseconds for a dissolve', () => {
    expect(
      transitionTimes(
        withTransition(
          {kind: 'dissolve', sec: 1.5},
          {kind: 'dissolve', seconds: 3},
        ),
      ),
    ).toEqual({slideMs: 1500, backgroundMs: 3000});
  });

  it('makes 없음 a cut whatever the seconds are, each part on its own', () => {
    expect(
      transitionTimes(
        withTransition(
          {kind: 'none', sec: 1},
          {kind: 'dissolve', seconds: 0.1},
        ),
      ),
    ).toEqual({slideMs: 0, backgroundMs: 100});
  });
});

const defaults = defaultPreferences.output.transition;
const slide = {itemId: 'song', position: 1, label: null, lines: ['New']};
it('uses item identity, not slide position, to choose defaults', () => {
  const firstSlide = {...slide, position: 0};
  expect(slideTransitionFor(defaults, 'other', slide)).toEqual(
    defaults.between,
  );
  expect(slideTransitionFor(defaults, 'song', firstSlide)).toEqual(
    defaults.within,
  );
  expect(slideTransitionFor(defaults, null, slide)).toEqual(defaults.between);
});
it.each(['none', 'dissolve', 'push', 'wipe'] as const)(
  'lets a slide override both defaults with %s',
  kind => {
    const transition = {kind, sec: 2};
    for (const previous of ['song', 'other', null]) {
      expect(
        slideTransitionFor(defaults, previous, {...slide, transition}),
      ).toEqual(transition);
    }
  },
);
