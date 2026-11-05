import {describe, expect, it} from 'vitest';
import {parseGroupedSong, serializeGroupedSong} from '@core/schema/groupedSong';
import {parseContentEdit} from '@core/schema/contentEdit';
import type {
  TextImportOptions,
  TextImportPreviewRequest,
} from '@core/schema/textImport';
import {importGroups} from '@core/songs/importGroups';
import {convertTextImport, textImportHeaders} from '@core/songs/textImport';
import {TEXT_IMPORT_LIMITS} from '@core/songs/textImportLimits';

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
  it('lists distinct headers in file order with the first lyric of their first use', () => {
    expect(
      textImportHeaders(
        '\uFEFFIntro\r\n[ Chorus ]\r\n\r\n First lyric\r\nSecond lyric\r\n[chorus]\r\nLater\r\n[Tag]\r\n[Bridge]\r\nFinal\r\n[tag]\r\nNot the first use\r\n(not a header)',
      ),
    ).toEqual([
      {name: 'Chorus', firstLine: 'First lyric'},
      {name: 'Tag', firstLine: ''},
      {name: 'Bridge', firstLine: 'Final'},
    ]);
  });
  it.each(['\u0000', '"', '\\'])(
    'keeps an accepted escaped preview savable: %j',
    character => {
      const preview = draft(character.repeat(150_000));
      const groups = importGroups(preview.slides, () => crypto.randomUUID());
      const edit = parseContentEdit({
        type: 'song.import',
        target: {kind: 'new'},
        draft: {title: preview.title || 'Invented', groups},
      });
      expect(edit.ok).toBe(true);
      const saved = parseGroupedSong(
        JSON.stringify({
          format: 'llsong',
          schemaVersion: 1,
          id: '00000000-0000-4000-8000-000000000001',
          title: 'Invented',
          groups,
        }),
        'invented.llsong',
      );
      if (!saved.ok) throw new Error(saved.error.message);
      expect(serializeGroupedSong(saved.value.data, 'invented.llsong').ok).toBe(
        true,
      );
      expect(saved.value.data.groups[0]?.slides[0]?.lines).toEqual(
        preview.slides[0]?.lines,
      );
    },
  );

  it('counts slide JSON structure as well as lyric characters', () => {
    const line = 'a'.repeat(180);
    expect(
      convertTextImport(
        request(Array.from({length: 5000}, () => line).join('\n'), {
          unitsPerSlide: 1,
        }),
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
  });
  it('rejects JSON escaping expansion before offering an unsavable preview', () => {
    expect(convertTextImport(request('\u0000'.repeat(170_000)))).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
  });

  it('normalizes BOM, CRLF, CR, tabs, and trailing spaces while keeping lyric indentation', () => {
    expect(draft('\uFEFF\r\n  First\tline  \rSecond\tline\t\r\n\r\n')).toEqual({
      title: 'Example.song',
      slides: [{lines: ['  First line', 'Second line'], section: 0}],
    });
  });

  it('trims boundary blank lines before enforcing the line limit', () => {
    const text = Array.from(
      {length: TEXT_IMPORT_LIMITS.lines},
      () => 'Invented',
    ).join('\n');
    const options = {
      unitsPerSlide: TEXT_IMPORT_LIMITS.unitsPerSlide,
      labels: 'off' as const,
    };
    const result = convertTextImport(
      request(` \n\t\n${text}\n\n \t\n`, options),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    expect(result.value.slides.flatMap(slide => slide.lines)).toHaveLength(
      TEXT_IMPORT_LIMITS.lines,
    );
    expect(
      convertTextImport(request(`${text}\nAnother\n`, options)),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      draft(`${'\n'.repeat(TEXT_IMPORT_LIMITS.lines)}Invented`).slides,
    ).toEqual([{lines: ['Invented'], section: 0}]);
  });

  it('groups line breaks without joining across a stanza', () => {
    expect(draft('One\nTwo\nThree\n\nFour\nFive\nSix').slides).toEqual([
      {lines: ['One', 'Two'], section: 0},
      {lines: ['Three'], section: 0},
      {lines: ['Four', 'Five'], section: 0},
      {lines: ['Six'], section: 0},
    ]);
  });

  it('groups paragraphs and preserves their blank separator', () => {
    const text = 'One\nTwo\n\nThree\n\n\nFour\nFive';
    expect(draft(text, {split: 'blankLine', unitsPerSlide: 1}).slides).toEqual([
      {lines: ['One', 'Two'], section: 0},
      {lines: ['Three'], section: 0},
      {lines: ['Four', 'Five'], section: 0},
    ]);
    expect(draft(text, {split: 'blankLine', unitsPerSlide: 2}).slides).toEqual([
      {lines: ['One', 'Two', '', 'Three'], section: 0},
      {lines: ['Four', 'Five'], section: 0},
    ]);
  });

  it('splits a literal symbol inline or on its own line and drops empty units', () => {
    expect(
      draft(' /One / Two\nStill two\n/\n/ Three/ ', {
        split: 'symbol',
        symbol: '/',
        unitsPerSlide: 2,
      }).slides,
    ).toEqual([
      {lines: ['One', 'Two', 'Still two'], section: 0},
      {lines: ['Three'], section: 0},
    ]);
    expect(
      draft('One.*Two.*.*Three', {
        split: 'symbol',
        symbol: '.*',
        unitsPerSlide: 1,
      }).slides,
    ).toEqual([
      {lines: ['One'], section: 0},
      {lines: ['Two'], section: 0},
      {lines: ['Three'], section: 0},
    ]);
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
        {lines: ['Before'], section: 0},
        {label: '후렴', lines: ['After', 'Again'], section: 1},
        {label: 'Chorus', lines: ['Last'], section: 2},
      ]);
    },
  );

  it('preserves bracket labels across all emitted slides in a candidate group section', () => {
    expect(
      draft('[후렴]\n\nOne\nTwo\nThree\nFour', {unitsPerSlide: 1}).slides,
    ).toEqual([
      {label: '후렴', lines: ['One'], section: 0},
      {label: '후렴', lines: ['Two'], section: 0},
      {label: '후렴', lines: ['Three'], section: 0},
      {label: '후렴', lines: ['Four'], section: 0},
    ]);
    expect(
      draft('[Old]\n[New]\nOne\n[Unused]', {unitsPerSlide: 1}).slides,
    ).toEqual([{label: 'New', lines: ['One'], section: 0}]);
  });

  it('treats bracket text as lyrics when detection is off and keeps other bracket forms', () => {
    expect(draft('[후렴]\nOne', {labels: 'off'}).slides).toEqual([
      {lines: ['[후렴]', 'One'], section: 0},
    ]);
    expect(
      draft('(후렴)\nText [후렴]\n[ ]', {unitsPerSlide: 10}).slides,
    ).toEqual([{lines: ['(후렴)', 'Text [후렴]', '[ ]'], section: 0}]);
  });

  it('always uses a file name stem and keeps the first lyric line', () => {
    expect(draft('First\nSecond', {firstLine: 'title'})).toEqual({
      title: 'Example.song',
      slides: [{lines: ['First', 'Second'], section: 0}],
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
        slides: [{label: '후렴', lines: ['First', 'Second'], section: 0}],
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
      value: {title: '', slides: [{lines: ['First', 'Second'], section: 0}]},
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
        slides: [
          {label: '후렴', lines: ['One', 'Two']},
          {label: '후렴', lines: ['Three']},
        ],
      },
    });
    expect(convertTextImport(value)).toEqual(first);
    expect(value).toEqual(original);
  });

  it('refuses a bracket label exceeding the label length limit', () => {
    const longLabel = `[${'a'.repeat(TEXT_IMPORT_LIMITS.label + 1)}]`;
    expect(convertTextImport(request(`${longLabel}\nLyric line`))).toEqual({
      ok: false,
      error: {
        reason: 'invalid',
        message: 'The text import exceeds its size limit',
      },
    });
  });

  it('refuses an aggregate draft exceeding the draft characters limit', () => {
    const label = `[${'a'.repeat(500)}]`;
    const slides = 'Line\n'.repeat(2500);
    expect(
      convertTextImport(request(`${label}\n${slides}`, {unitsPerSlide: 1})),
    ).toEqual({
      ok: false,
      error: {
        reason: 'invalid',
        message: 'The text import exceeds its size limit',
      },
    });
  });

  it('numbers adjacent sections with identical names apart', () => {
    const text = '[후렴]\nFirst chorus\n[후렴]\nSecond chorus';
    const result = draft(text, {unitsPerSlide: 1});
    expect(result.slides).toEqual([
      {label: '후렴', lines: ['First chorus'], section: 0},
      {label: '후렴', lines: ['Second chorus'], section: 1},
    ]);
  });
});
