import {describe, expect, it} from 'vitest';
import {parseReference, resolvePassage} from './reference';
import {parsedTranslation, translationFile} from './testFiles';

const translation = parsedTranslation();

describe('Bible reference grammar and lookup', () => {
  it.each([
    '요 3:16-18',
    '요 3장 16-18절',
    '요한복음3장16~18절',
    '요3:16~18',
    'John 3 : 16 - 18',
  ])('resolves %j to the required three verses', input => {
    const result = resolvePassage(translation, input);
    expect(result).toMatchObject({
      ok: true,
      value: {ref: '요한복음 3:16-18', displayRef: '요한복음 3:16-18'},
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.verses.map(verse => verse.verse)).toEqual([16, 17, 18]);
    expect(result.value.verses[0]?.text).toBe(
      'Invented book 43, chapter 3, verse 16',
    );
  });

  it.each([
    ['요 3', '요한복음 3', 36],
    ['요3장', '요한복음 3', 36],
    ['요 3:16', '요한복음 3:16', 1],
    ['요3장16절', '요한복음 3:16', 1],
    ['요3:16-3:18', '요한복음 3:16-18', 3],
    ['요3장16절-3장18절', '요한복음 3:16-18', 3],
    ['요3:16-16', '요한복음 3:16', 1],
    ['요3:16-3:16', '요한복음 3:16', 1],
    ['요3:35-4:2', '요한복음 3:35-4:2', 4],
    ['요3장35절~4장2절', '요한복음 3:35-4:2', 4],
    ['요3:35-4:35', '요한복음 3:35-4:8', 10],
    ['요3:16-99', '요한복음 3:16-36', 21],
    ['요3:36-99', '요한복음 3:36', 1],
  ])('normalizes %j to %s', (input, ref, count) => {
    const result = resolvePassage(translation, input);
    expect(result).toMatchObject({ok: true, value: {ref}});
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.verses).toHaveLength(count);
    expect(resolvePassage(translation, result.value.ref)).toEqual(result);
  });

  it.each([
    ['', 'syntax'],
    ['요', 'syntax'],
    ['요3:16-4장2절', 'syntax'],
    ['요3장16절-4:2', 'syntax'],
    ['요0:1', 'syntax'],
    ['요3:0', 'syntax'],
    ['요3:16-0', 'syntax'],
    ['요-1:1', 'syntax'],
    ['요3.5:16', 'syntax'],
    ['요9007199254740992:1', 'syntax'],
    ['요3:16tail', 'syntax'],
    ['unknown3:16', 'unknownBook'],
    ['베1:1', 'ambiguousBook'],
    ['창1:1', 'missingBook'],
    ['요22:1', 'chapter'],
    ['요3:16-22:1', 'chapter'],
    ['요3:40', 'verse'],
    ['요3:18-16', 'reversed'],
    ['요4:2-3:16', 'reversed'],
  ])('returns a reason for invalid reference %j', (input, code) => {
    const result = resolvePassage(translation, input);
    expect(result).toMatchObject({
      ok: false,
      error: {code},
    });
    if (result.ok) throw new Error('Expected an invalid reference');
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it('offers ambiguous book choices and resolves numbered and IME-off names', () => {
    expect(parseReference('베1:1')).toMatchObject({
      ok: false,
      error: {suggestions: [{id: 49}, {id: 60}, {id: 61}]},
    });
    expect(parseReference('ckd1:1')).toMatchObject({
      ok: true,
      value: {book: {id: 1}},
    });
    expect(
      resolvePassage(parsedTranslation(translationFile([62])), '1John1:1'),
    ).toMatchObject({ok: true, value: {ref: '요한일서 1:1'}});
  });

  it('uses the translation language for display without changing the normalized reference', () => {
    const english = parsedTranslation({
      ...translationFile(),
      language: 'en-US',
    });
    expect(resolvePassage(english, '요3:16')).toMatchObject({
      ok: true,
      value: {ref: '요한복음 3:16', displayRef: 'John 3:16'},
    });
  });

  it('skips omitted verses without renumbering or changing the requested range', () => {
    const source = translationFile();
    const chapter = source.books[0]?.chapters[2];
    if (!chapter) throw new Error('Missing fixture chapter');
    chapter[16] = '';
    const file = parsedTranslation(source);
    expect(resolvePassage(file, '요3:16-18')).toMatchObject({
      ok: true,
      value: {ref: '요한복음 3:16-18', verses: [{verse: 16}, {verse: 18}]},
    });
    expect(resolvePassage(file, '요3:17')).toMatchObject({
      ok: false,
      error: {code: 'omitted'},
    });
    expect(resolvePassage(file, '요3:17-18')).toMatchObject({
      ok: true,
      value: {ref: '요한복음 3:17-18', verses: [{verse: 18}]},
    });
    chapter.fill('');
    expect(resolvePassage(parsedTranslation(source), '요3')).toMatchObject({
      ok: false,
      error: {code: 'omitted'},
    });
  });
});
