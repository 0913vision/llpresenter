import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {slideTransitionSchema} from '@core/schema/slideTransition';
import {songSlideSchema} from '@core/schema/song';
import {slideSchema} from '@core/schema/service';

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
  it('keeps old song slides untouched and preserves transition extension fields', () => {
    const slide = {
      id: '00000000-0000-4000-8000-000000000001',
      lines: ['A new morning'],
      extra: 1,
    };
    expect(v.parse(songSlideSchema, slide)).toEqual(slide);
    const own = {
      ...slide,
      transition: {kind: 'wipe', dir: 'left', sec: 4, future: 1},
    };
    expect(v.parse(songSlideSchema, own)).toEqual(own);
  });
  it.each([
    {id: '00000000-0000-4000-8000-000000000001', text: ''},
    {
      id: '00000000-0000-4000-8000-000000000001',
      text: 'Announcement',
      name: 'News',
    },
    {
      id: '00000000-0000-4000-8000-000000000001',
      media: '00000000-0000-4000-8000-000000000002',
    },
  ])('validates the same override on a service slide %j', slide => {
    const own = {...slide, transition: {kind: 'push', dir: 'down', sec: 2}};
    expect(v.parse(slideSchema, own)).toEqual(own);
    expect(
      v.safeParse(slideSchema, {...slide, transition: {kind: 'push', sec: 11}})
        .success,
    ).toBe(false);
  });
});
