import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {
  liveItemKinds,
  liveItemSchema,
  liveThemeOutputSchema,
} from '@core/schema/live/liveTheme';
import {LIVE_STATE_LIMITS} from '@core/schema/live/liveLimits';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';

describe('the item on output', () => {
  it.each(liveItemKinds)('takes a %s item', kind => {
    expect(
      v.safeParse(liveItemSchema, {
        id: 'item-1',
        kind,
        source: 'service',
        slidePosition: 2,
        startedAt: 1000,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['an empty id', {id: ''}],
    ['an unknown kind', {kind: 'video'}],
    ['an unknown source', {source: 'library'}],
    ['a negative slide position', {slidePosition: -1}],
    ['a start time that is not a number', {startedAt: Number.NaN}],
  ])('refuses %s', (_name, change) => {
    expect(
      v.safeParse(liveItemSchema, {
        id: 'item-1',
        kind: 'song',
        source: 'service',
        ...change,
      }).success,
    ).toBe(false);
  });
});

describe('the theme on output', () => {
  const theme = BUILT_IN_THEMES[0];

  function output(change: object) {
    return {
      theme,
      background: {kind: 'none'},
      revision: 1,
      missing: [],
      emptyColors: {},
      ...change,
    };
  }

  it('takes a theme with its background and the empty color of screens', () => {
    expect(
      v.safeParse(
        liveThemeOutputSchema,
        output({emptyColors: {main: '#000000'}, missing: ['theme-x']}),
      ).success,
    ).toBe(true);
  });

  it('refuses more than two missing themes or more empty colors than outputs', () => {
    expect(
      v.safeParse(liveThemeOutputSchema, output({missing: ['a', 'b', 'c']}))
        .success,
    ).toBe(false);
    const colors = Object.fromEntries(
      Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, index) => [
        `screen-${index}`,
        '#000000',
      ]),
    );
    expect(
      v.safeParse(liveThemeOutputSchema, output({emptyColors: colors})).success,
    ).toBe(false);
  });
});
