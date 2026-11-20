import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {biblePassagePictureKey, bibleSource} from '@core/bible/source';
import {translationIdSchema} from '@core/schema/ids';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';

describe('bibleSource', () => {
  it('partitions pictures by the resolved passage, lookup content and display options', () => {
    const translation = v.parse(translationIdSchema, 'sample');
    const passage = {
      translation,
      ref: '창세기 1:1',
      displayRef: '창세기 1:1',
      verses: [{chapter: 1, verse: 1, text: 'Same text'}],
    };
    const identity = biblePassagePictureKey(bibleSource(passage));
    expect(biblePassagePictureKey(bibleSource({...passage}))).toBe(identity);
    expect(
      biblePassagePictureKey(bibleSource({...passage, ref: '출애굽기 1:1'})),
    ).not.toBe(identity);
    expect(
      biblePassagePictureKey(
        bibleSource({
          ...passage,
          translation: v.parse(translationIdSchema, 'another'),
        }),
      ),
    ).not.toBe(identity);
    expect(
      biblePassagePictureKey(
        bibleSource({
          ...passage,
          verses: [{chapter: 1, verse: 1, text: 'Replacement'}],
        }),
      ),
    ).not.toBe(identity);
    expect(
      biblePassagePictureKey(bibleSource(passage, {verseNumbers: false})),
    ).not.toBe(identity);
  });
  it('keeps long verses within output line limits without splitting Unicode pairs', () => {
    const text = '𠀀'.repeat(LIVE_STATE_LIMITS.textCharacters);
    const source = bibleSource({
      translation: v.parse(translationIdSchema, 'sample'),
      ref: '창세기 1:1',
      displayRef: '창세기 1:1',
      verses: [{chapter: 1, verse: 1, text}],
    });
    const lines = source.tiles[0]?.lines ?? [];

    expect(
      lines.every(line => line.length <= LIVE_STATE_LIMITS.textCharacters),
    ).toBe(true);
    expect(
      lines.every(line => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u.test(line)),
    ).toBe(true);
    expect(lines.join('')).toBe(`1 ${text}`);
  });
});
