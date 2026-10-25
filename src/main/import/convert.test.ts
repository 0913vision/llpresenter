import {describe, expect, it} from 'vitest';
import type {
  TextImportOptions,
  TextImportPreviewRequest,
} from '@shared/schema/textImport';
import {convertTextImport} from './convert';
import {TEXT_IMPORT_LIMITS} from './limits';

const defaults: TextImportOptions = {
  split: 'lineBreak',
  unitsPerSlide: 2,
  labels: 'bracketLine',
  firstLine: 'lyrics',
};

function request(
  text: string,
  options: Partial<TextImportOptions> = {},
): TextImportPreviewRequest {
  return {
    source: {source: 'file', fileName: 'Example.song.txt', text},
    options: {...defaults, ...options},
  };
}

function draft(text: string, options: Partial<TextImportOptions> = {}) {
  const result = convertTextImport(request(text, options));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('text import conversion', () => {
  it('normalizes BOM, CRLF, CR, tabs, and trailing spaces while keeping lyric indentation', () => {
    expect(draft('\uFEFF\r\n  First\tline  \rSecond\tline\t\r\n\r\n')).toEqual({
      title: 'Example.song',
      slides: [{lines: ['  First line', 'Second line']}],
    });
  });

  it('groups line breaks without joining across a stanza', () => {
    expect(draft('One\nTwo\nThree\n\nFour\nFive\nSix').slides).toEqual([
      {lines: ['One', 'Two']},
      {lines: ['Three']},
      {lines: ['Four', 'Five']},
      {lines: ['Six']},
    ]);
  });

  it('groups paragraphs and preserves their blank separator', () => {
    const text = 'One\nTwo\n\nThree\n\n\nFour\nFive';
    expect(draft(text, {split: 'blankLine', unitsPerSlide: 1}).slides).toEqual([
      {lines: ['One', 'Two']},
      {lines: ['Three']},
      {lines: ['Four', 'Five']},
    ]);
    expect(draft(text, {split: 'blankLine', unitsPerSlide: 2}).slides).toEqual([
      {lines: ['One', 'Two', '', 'Three']},
      {lines: ['Four', 'Five']},
    ]);
  });

  it('splits a literal symbol inline or on its own line and drops empty units', () => {
    expect(
      draft(' /One / Two\nStill two\n/\n/ Three/ ', {
        split: 'symbol',
        symbol: '/',
        unitsPerSlide: 2,
      }).slides,
    ).toEqual([{lines: ['One', 'Two', 'Still two']}, {lines: ['Three']}]);
    expect(
      draft('One.*Two.*.*Three', {
        split: 'symbol',
        symbol: '.*',
        unitsPerSlide: 1,
      }).slides,
    ).toEqual([{lines: ['One']}, {lines: ['Two']}, {lines: ['Three']}]);
  });

  it.each(['lineBreak', 'blankLine', 'symbol'] as const)(
    'starts a new slide at a bracket label in %s mode',
    split => {
      const result = draft('Before\n[ 후렴 ]\nAfter\nAgain\n[Chorus]\nLast', {
        split,
        symbol: '/',
        unitsPerSlide: 100,
      });
      expect(result.slides).toEqual([
        {lines: ['Before']},
        {label: '후렴', lines: ['After', 'Again']},
        {label: 'Chorus', lines: ['Last']},
      ]);
    },
  );

  it('labels only the next emitted slide, including after blank lines', () => {
    expect(
      draft('[후렴]\n\nOne\nTwo\nThree\nFour', {unitsPerSlide: 1}).slides,
    ).toEqual([
      {label: '후렴', lines: ['One']},
      {lines: ['Two']},
      {lines: ['Three']},
      {lines: ['Four']},
    ]);
    expect(
      draft('[Old]\n[New]\nOne\n[Unused]', {unitsPerSlide: 1}).slides,
    ).toEqual([{label: 'New', lines: ['One']}]);
  });

  it('treats bracket text as lyrics when detection is off and keeps other bracket forms', () => {
    expect(draft('[후렴]\nOne', {labels: 'off'}).slides).toEqual([
      {lines: ['[후렴]', 'One']},
    ]);
    expect(
      draft('(후렴)\nText [후렴]\n[ ]', {unitsPerSlide: 10}).slides,
    ).toEqual([{lines: ['(후렴)', 'Text [후렴]', '[ ]']}]);
  });

  it('always uses a file name stem and keeps the first lyric line', () => {
    expect(draft('First\nSecond', {firstLine: 'title'})).toEqual({
      title: 'Example.song',
      slides: [{lines: ['First', 'Second']}],
    });
  });

  it('takes the first nonlabel clipboard line as title and leaves labels for lyrics', () => {
    const value = request('\n[후렴]\n\n  New title \nFirst\nSecond', {
      firstLine: 'title',
    });
    expect(
      convertTextImport({
        ...value,
        source: {source: 'clipboard', fileName: null, text: value.source.text},
      }),
    ).toEqual({
      ok: true,
      value: {
        title: 'New title',
        slides: [{label: '후렴', lines: ['First', 'Second']}],
      },
    });
    const lyrics = request('First\nSecond');
    expect(
      convertTextImport({
        ...lyrics,
        source: {source: 'clipboard', fileName: null, text: lyrics.source.text},
      }),
    ).toEqual({
      ok: true,
      value: {title: '', slides: [{lines: ['First', 'Second']}]},
    });
  });

  it.each(['', ' \t\n', '[후렴]\n[End]'])(
    'refuses a draft without lyric lines: %j',
    text => {
      expect(convertTextImport(request(text))).toMatchObject({
        ok: false,
        error: {reason: 'empty'},
      });
    },
  );

  it('refuses a clipboard title with no remaining lyrics', () => {
    const value = request('Title', {firstLine: 'title'});
    expect(
      convertTextImport({
        ...value,
        source: {source: 'clipboard', fileName: null, text: 'Title'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'empty'}});
  });

  it('refuses replacement characters in a retained source', () => {
    expect(convertTextImport(request('Bad\uFFFDtext'))).toMatchObject({
      ok: false,
      error: {reason: 'decode-failed'},
    });
  });

  it('bounds input and output without returning a truncated draft', () => {
    for (const value of [
      request('a'.repeat(TEXT_IMPORT_LIMITS.characters + 1)),
      request('a\n'.repeat(TEXT_IMPORT_LIMITS.lines + 1)),
      request(
        `${'\n'.repeat(TEXT_IMPORT_LIMITS.lines)}Do not silently lose this`,
      ),
      request('a\n'.repeat(TEXT_IMPORT_LIMITS.slides + 1), {unitsPerSlide: 1}),
      request('/'.repeat(TEXT_IMPORT_LIMITS.units + 1), {
        split: 'symbol',
        symbol: '/',
      }),
      request('One', {unitsPerSlide: TEXT_IMPORT_LIMITS.unitsPerSlide + 1}),
    ]) {
      expect(convertTextImport(value)).toMatchObject({
        ok: false,
        error: {reason: 'invalid'},
      });
    }
  });

  it('rebuilds an immutable retained source without changing it or remembering labels', () => {
    const value = request('[후렴]\nOne\nTwo\nThree', {unitsPerSlide: 1});
    const original = structuredClone(value);
    const first = convertTextImport(value);
    expect(
      convertTextImport({
        ...value,
        options: {...value.options, unitsPerSlide: 2},
      }),
    ).toMatchObject({
      ok: true,
      value: {
        slides: [{label: '후렴', lines: ['One', 'Two']}, {lines: ['Three']}],
      },
    });
    expect(convertTextImport(value)).toEqual(first);
    expect(value).toEqual(original);
  });
});
