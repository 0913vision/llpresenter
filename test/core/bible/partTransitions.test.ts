import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {translationIdSchema} from '@core/schema/ids';
import {
  biblePartLabelsSchema,
  biblePartTransitionsSchema,
} from '@core/schema/service';
import {
  biblePartEffect,
  setBiblePartEffect,
  biblePartLabel,
  setBiblePartLabel,
} from '@core/bible/partTransitions';

const verse = {
  translation: v.parse(translationIdSchema, 'test'),
  book: 1,
  chapter: 1,
  verse: 2,
};
const effect = {kind: 'wipe' as const, dir: 'left' as const, sec: 0.7};

describe('Bible part transitions', () => {
  it('adds, changes and removes one part without affecting another', () => {
    const first = setBiblePartEffect([], {verse, part: 1}, effect);
    const both = setBiblePartEffect(
      first,
      {verse, part: 2},
      {
        kind: 'dissolve',
        sec: 2,
      },
    );
    expect(biblePartEffect(both, verse, 1)).toEqual(effect);
    expect(biblePartEffect(both, verse, 2)).toEqual({kind: 'dissolve', sec: 2});
    const changed = setBiblePartEffect(
      both,
      {verse, part: 1},
      {kind: 'push', sec: 1},
    );
    const removed = setBiblePartEffect(changed, {verse, part: 1}, undefined);
    expect(biblePartEffect(removed, verse, 1)).toBeUndefined();
    expect(biblePartEffect(removed, verse, 2)).toEqual({
      kind: 'dissolve',
      sec: 2,
    });
    expect(biblePartEffect(removed, {...verse, verse: 3}, 2)).toBeUndefined();
  });
  it('rejects duplicate verse-part keys', () => {
    const entry = {verse, part: 1, transition: effect};
    expect(
      v.safeParse(biblePartTransitionsSchema, [entry, entry]).success,
    ).toBe(false);
    expect(v.safeParse(biblePartTransitionsSchema, [entry]).success).toBe(true);
  });
});

describe('Bible part labels', () => {
  it('keeps labels by verse and split part and removes only the requested label', () => {
    const first = setBiblePartLabel([], {verse, part: 1}, 'First');
    const both = setBiblePartLabel(first, {verse, part: 2}, 'Second');
    const removed = setBiblePartLabel(both, {verse, part: 1}, undefined);
    expect(biblePartLabel(removed, verse, 1)).toBeUndefined();
    expect(biblePartLabel(removed, verse, 2)).toBe('Second');
  });
  it('validates labels, part bounds, and distinct part identities', () => {
    const entry = {verse, part: 1, label: 'First'};
    expect(v.safeParse(biblePartLabelsSchema, [entry]).success).toBe(true);
    expect(v.safeParse(biblePartLabelsSchema, [entry, entry]).success).toBe(
      false,
    );
    expect(
      v.safeParse(biblePartLabelsSchema, [{...entry, label: '  '}]).success,
    ).toBe(false);
    expect(
      v.safeParse(biblePartLabelsSchema, [{...entry, part: 0}]).success,
    ).toBe(false);
    expect(
      v.safeParse(biblePartLabelsSchema, [{...entry, part: 10001}]).success,
    ).toBe(false);
  });
});
