import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {slideTransitionSchema} from '@core/schema/slideTransition';
import {slideSchema} from '@core/schema/slide';
import {lyricsSlide} from '@fixtures/core/slides';

describe('slide transitions', () => {
  it.each(['none', 'dissolve', 'push', 'wipe'])(
    'accepts %s at both caps',
    kind => {
      for (const sec of [0.1, 10]) {
        expect(v.safeParse(slideTransitionSchema, {kind, sec}).success).toBe(
          true,
        );
      }
    },
  );
  it.each(['left', 'right', 'up', 'down'])(
    'accepts %s only on directional effects',
    dir => {
      for (const kind of ['push', 'wipe']) {
        expect(
          v.safeParse(slideTransitionSchema, {kind, dir, sec: 0.5}).success,
        ).toBe(true);
      }
      for (const kind of ['none', 'dissolve']) {
        expect(
          v.safeParse(slideTransitionSchema, {kind, dir, sec: 0.5}).success,
        ).toBe(false);
      }
    },
  );
  it.each([
    {},
    {kind: 'zoom', sec: 1},
    {kind: 'wipe', dir: 'in', sec: 1},
    {kind: 'wipe', sec: 0},
    {kind: 'none', sec: 10.1},
    {kind: 'push', sec: Infinity},
    {kind: 'dissolve', sec: NaN},
    {kind: 'wipe', sec: '1'},
    {kind: 'none', sec: 1, dir: null},
  ])('rejects invalid transition %j', value => {
    expect(v.safeParse(slideTransitionSchema, value).success).toBe(false);
  });
  it('keeps the fields of a transition it does not know', () => {
    const slide = lyricsSlide(1, 'A new morning');
    const own = {
      ...slide,
      transition: {kind: 'wipe', dir: 'left', sec: 4, future: 1},
    };
    expect(v.parse(slideSchema, own)).toEqual(own);
    expect(
      v.safeParse(slideSchema, {...slide, transition: {kind: 'push', sec: 11}})
        .success,
    ).toBe(false);
  });
});
