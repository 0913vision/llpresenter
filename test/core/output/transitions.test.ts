import {describe, expect, it} from 'vitest';
import {
  DEFAULT_TRANSITION_TIMES,
  slideTransitionFor,
  transitionTimes,
} from '@core/output/transitions';
import {defaultPreferences} from '@core/schema/preferences';

const defaults = defaultPreferences.output.transition;
const slide = {itemId: 'song', position: 1, label: null, lines: ['New']};

describe('per-slide transitions', () => {
  it('cuts without an assigned slide effect, regardless of saved preferences or theme', () => {
    expect(DEFAULT_TRANSITION_TIMES).toEqual({slideMs: 0, backgroundMs: 0});
    expect(
      slideTransitionFor(defaults, 'song', {
        ...slide,
        themeTransition: {kind: 'wipe', sec: 1},
      }),
    ).toEqual({kind: 'none', sec: 0.5});
  });
  it.each(['none', 'dissolve', 'push', 'wipe'] as const)(
    'uses %s for the incoming slide and background',
    kind => {
      const effect = {kind, sec: 1.5};
      expect(
        slideTransitionFor(defaults, 'other', {...slide, transition: effect}),
      ).toEqual(effect);
      const ms = kind === 'none' ? 0 : 1500;
      expect(transitionTimes(defaultPreferences, effect)).toEqual({
        slideMs: ms,
        backgroundMs: ms,
      });
    },
  );
});

describe('backward transitions', () => {
  it.each([
    ['left', 'right'],
    ['right', 'left'],
    ['up', 'down'],
    ['down', 'up'],
  ] as const)('reverses a wipe from %s to %s', (dir, opposite) => {
    expect(
      slideTransitionFor(defaults, 'song', {
        ...slide,
        transition: {kind: 'dissolve', sec: 1},
        reverseTransition: {kind: 'wipe', dir, sec: 2},
      }),
    ).toEqual({kind: 'wipe', dir: opposite, sec: 2});
  });
  it.each(['none', 'dissolve', 'push'] as const)(
    'reverses %s without using the target slide effect',
    kind => {
      expect(
        slideTransitionFor(defaults, 'song', {
          ...slide,
          transition: {kind: 'wipe', sec: 1},
          reverseTransition: {kind, sec: 2},
        }),
      ).toEqual(
        kind === 'push' ? {kind, sec: 2, dir: 'right'} : {kind, sec: 2},
      );
    },
  );
  it('cuts when the slide being left has no transition', () => {
    expect(
      slideTransitionFor(defaults, 'song', {
        ...slide,
        transition: {kind: 'wipe', sec: 1},
        reverseTransition: null,
      }),
    ).toEqual({kind: 'none', sec: 0.5});
  });
});
