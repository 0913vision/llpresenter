import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {bibleCutsSchema, BIBLE_CUTS_LIMITS} from '@core/schema/bibleCuts';
import {translationIdSchema} from '@core/schema/ids';
import {
  entryFor,
  knownCutsFor,
  saveCuts,
  textHash,
} from '@core/bible/split/splitCache';
import {
  cutsOfVerse,
  firstSlidePrefix,
  splitVersesForSlides,
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

  it('uses confirmed cuts, avoids review, and leaves the input intact', () => {
    const automatic = splitVersesForSlides([verse], layout);
    const cuts = cutsOfVerse(automatic, reference);
    const saved = saveCuts(
      empty(),
      reference,
      entryFor(verse.text, cuts, confirmedAt),
    );
    if (saved === null) throw Error('Unexpected full cache');
    const snapshot = JSON.stringify(saved);
    const parts = splitVersesForSlides([verse], layout, saved);
    expect(parts.map(part => part.text)).toEqual(
      automatic.map(part => part.text),
    );
    expect(parts.every(part => part.manual)).toBe(true);
    expect(versesToReview(parts)).toEqual([]);
    expect(versesToReview(automatic)).toEqual([reference]);
    expect(parts.at(-1)?.continued).toBe(false);
    expect(parts[0]).toMatchObject({part: 1, partCount: parts.length});
    expect(JSON.stringify(saved)).toBe(snapshot);
    expect(verse.text).toBe(MOCK_LONG_VERSE);
  });

  it('ignores changed text, translation mismatches, invalid indices, and currently overflowing saved cuts without deleting them', () => {
    const original = empty();
    for (const cuts of [[1], [999]]) {
      const saved = saveCuts(
        original,
        reference,
        entryFor(verse.text, cuts, confirmedAt),
      );
      if (saved === null) throw Error('Unexpected full cache');
      const snapshot = JSON.stringify(saved);
      const parts = splitVersesForSlides([verse], layout, saved);
      expect(parts.every(part => !part.manual)).toBe(true);
      expect(JSON.stringify(saved)).toBe(snapshot);
      expect(
        knownCutsFor(saved, reference, `${verse.text} 새말`),
      ).toBeUndefined();
      expect(
        knownCutsFor(
          saved,
          {...reference, translation: v.parse(translationIdSchema, 'kjv')},
          verse.text,
        ),
      ).toBeUndefined();
    }
  });

  it('reuses a saved entry when the layout fits again', () => {
    const saved = saveCuts(
      empty(),
      reference,
      entryFor(verse.text, [], confirmedAt),
    );
    if (saved === null) throw Error('Unexpected full cache');
    expect(
      splitVersesForSlides([verse], layout, saved).every(part => !part.manual),
    ).toBe(true);
    expect(
      splitVersesForSlides([verse], mockSplitLayout(500, 2), saved)[0]?.manual,
    ).toBe(true);
  });

  it('counts numbers for multiple verses and preserves the original verse on measurement failure', () => {
    expect(firstSlidePrefix(verse, {singleVerse: true})).toBe('');
    expect(firstSlidePrefix(verse, {singleVerse: false})).toBe('16 ');
    expect(splitVersesForSlides([], layout)).toEqual([]);
    const parts = splitVersesForSlides(
      [
        verse,
        {...verse, reference: {...reference, verse: 17}, text: '새가 노래한다'},
      ],
      layout,
    );
    expect(parts.at(-1)?.reference.verse).toBe(17);
    expect(
      parts
        .filter(part => part.reference.verse === 16)
        .map(part => part.text)
        .join(' '),
    ).toBe(verse.text);
    const failed = splitVersesForSlides([verse], {
      ...layout,
      measure: () => {
        throw Error('Missing font');
      },
    });
    expect(failed).toEqual([
      {
        ...verse,
        display: verse.text,
        continued: false,
        part: 1,
        partCount: 1,
        manual: false,
        problem: 'measurement',
      },
    ]);
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

  it('preserves the whole verse with an explicit problem when the first number prevents fitting', () => {
    const tooWide = {
      ...verse,
      reference: {...reference, verse: 176},
      text: '가나다라마 아',
    };
    const next = {...verse, reference: {...reference, verse: 177}, text: '아'};
    const parts = splitVersesForSlides([tooWide, next], mockSplitLayout(10, 1));
    expect(parts[0]).toEqual({
      ...tooWide,
      display: tooWide.text,
      continued: false,
      part: 1,
      partCount: 1,
      manual: false,
      problem: 'measurement',
    });
    expect(parts[1]).toMatchObject({
      reference: next.reference,
      text: next.text,
      partCount: 1,
    });
    expect(parts[1]).not.toHaveProperty('problem');
  });
});
