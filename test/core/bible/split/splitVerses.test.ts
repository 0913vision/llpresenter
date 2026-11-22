import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {bibleCutsSchema, BIBLE_CUTS_LIMITS} from '@core/schema/bibleCuts';
import {translationIdSchema} from '@core/schema/ids';
import {entryFor, saveCuts, textHash} from '@core/bible/split/splitCache';
import {
  cutsOfVerse,
  splitVerseParts,
  versesToReview,
} from '@core/bible/split/splitVerses';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';

const reference = {
  translation: v.parse(translationIdSchema, 'krv'),
  book: 43,
  chapter: 3,
  verse: 16,
};
const verse = {reference, text: MOCK_LONG_VERSE};
const empty = () =>
  v.parse(bibleCutsSchema, {
    format: 'llsettings.bibleCuts',
    schemaVersion: 1,
    entries: {},
  });
const confirmedAt = '2026-11-05T00:00:00.000Z';

describe('copible verse parts and saved cuts', () => {
  const layout = mockSplitLayout();

  it('hashes normalized text as FNV-1a and stores no text', () => {
    expect(textHash(' 가 \n 나 ')).toBe(textHash('가 나'));
    expect(textHash('가 나')).not.toBe(textHash('가 다'));
    expect(textHash('hello')).toBe('4f9f2cab');
    expect(entryFor('가 나', [1], confirmedAt)).toEqual({
      hash: textHash('가 나'),
      cuts: [1],
      confirmedAt,
    });
  });

  it('keeps refined cuts reviewable and lets valid confirmed cuts take precedence', () => {
    const automatic = splitVerseParts(verse, layout);
    const cuts = cutsOfVerse(automatic, reference);
    const refined = [...new Set([1, ...cuts])].sort((a, b) => a - b);
    const saved = saveCuts(
      empty(),
      reference,
      entryFor(verse.text, cuts, confirmedAt),
    );
    if (saved === null) throw Error('Cache full');
    const parts = splitVerseParts(verse, layout, {refined});
    expect(cutsOfVerse(parts, reference)).toEqual(refined);
    expect(versesToReview(parts)).toEqual([reference]);
    expect(
      cutsOfVerse(splitVerseParts(verse, layout, {saved, refined}), reference),
    ).toEqual(cuts);
  });

  it('refuses additional entries at the cap but allows replacing a confirmation', () => {
    const entry = entryFor(verse.text, [], confirmedAt);
    const entries = Object.fromEntries(
      Array.from({length: BIBLE_CUTS_LIMITS.entries}, (_, i) => [
        `1:1:${i + 1}`,
        entry,
      ]),
    );
    const full = v.parse(bibleCutsSchema, {
      ...empty(),
      entries: {krv: entries},
    });
    expect(saveCuts(full, reference, entry)).toBeNull();
    expect(
      saveCuts(full, {...reference, book: 1, chapter: 1, verse: 1}, entry),
    ).not.toBeNull();
    expect(Object.keys(full.entries[reference.translation] ?? {})).toHaveLength(
      BIBLE_CUTS_LIMITS.entries,
    );
  });
});
