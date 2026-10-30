import {describe, expect, it} from 'vitest';
import {
  parseTextImportReadRequest,
  parseTextImportClipboardAvailable,
  parseTextImportReadResult,
  parseTextImportPreviewRequest,
  parseTextImportPreviewResult,
} from './textImport';
import {expectSuccess} from './testHelpers';

const source = {
  source: 'file',
  fileName: '새 노래.txt',
  text: '첫째 문장\n둘째 문장',
} as const;

describe('clipboard availability boundary', () => {
  it.each([true, false])('accepts the bounded boolean %s', value => {
    expect(expectSuccess(parseTextImportClipboardAvailable(value))).toBe(value);
  });
  it.each([null, undefined, 0, 1, 'true', {}, []])(
    'rejects a nonboolean reply %j',
    value => {
      expect(parseTextImportClipboardAvailable(value).ok).toBe(false);
    },
  );
});
const options = {
  split: 'blankLine',
  unitsPerSlide: 1,
  labels: 'bracketLine',
  firstLine: 'title',
} as const;

describe('text import read boundary', () => {
  it('accepts each source and supported encoding', () => {
    for (const source of ['file', 'clipboard']) {
      for (const encoding of ['auto', 'utf-8', 'cp949']) {
        const request = {source, encoding};
        expect(expectSuccess(parseTextImportReadRequest(request))).toEqual(
          request,
        );
      }
    }
  });

  it.each([
    null,
    [],
    {source: 'path', encoding: 'auto'},
    {source: 'file', encoding: 'utf-16'},
    {source: 'file'},
    {encoding: 'auto'},
  ])('rejects malformed read %j', value => {
    expect(parseTextImportReadRequest(value).ok).toBe(false);
  });

  it('accepts decoded text, file-dialog cancellation, and typed failures', () => {
    for (const value of [
      source,
      {source: 'clipboard', fileName: null, text: ''},
      null,
    ]) {
      const result = {ok: true, value};
      expect(expectSuccess(parseTextImportReadResult(result))).toEqual(result);
    }
    const failure = {
      ok: false,
      error: {reason: 'decode-failed', message: 'Invalid bytes'},
    };
    expect(expectSuccess(parseTextImportReadResult(failure))).toEqual(failure);
  });

  it.each([
    {ok: true, value: {...source, fileName: ''}},
    {ok: true, value: {...source, text: 1}},
    {ok: true, value: {source: 'clipboard', fileName: 'name.txt', text: ''}},
    {ok: false, error: {reason: 'other', message: ''}},
    {ok: false},
  ])('rejects malformed read result %j', value => {
    expect(parseTextImportReadResult(value).ok).toBe(false);
  });
});

describe('text import preview boundary', () => {
  it('accepts all split modes and retained clipboard input', () => {
    for (const split of ['blankLine', 'lineBreak', 'symbol']) {
      const request = {
        source: {source: 'clipboard', fileName: null, text: '첫째 문장'},
        options: {
          ...options,
          split,
          symbol: '/',
          firstLine: 'lyrics',
          labels: 'off',
          unitsPerSlide: 2,
        },
      };
      expect(expectSuccess(parseTextImportPreviewRequest(request))).toEqual(
        request,
      );
    }
  });

  it.each([
    {...options, split: 'other'},
    {...options, split: 'symbol'},
    {...options, split: 'symbol', symbol: ' '},
    {...options, unitsPerSlide: 0},
    {...options, unitsPerSlide: 1.5},
    {...options, labels: true},
    {...options, firstLine: 'other'},
  ])('rejects malformed conversion options %j', invalid => {
    expect(parseTextImportPreviewRequest({source, options: invalid}).ok).toBe(
      false,
    );
  });

  it('checks the source again on conversion requests', () => {
    for (const invalid of [
      [],
      null,
      {...source, source: 'other'},
      {...source, fileName: null},
    ]) {
      expect(parseTextImportPreviewRequest({source: invalid, options}).ok).toBe(
        false,
      );
    }
  });

  it('keeps an unsaved blank title and file-shaped slide fields without adding an id', () => {
    const result: unknown = JSON.parse(
      '{"ok":true,"value":{"title":"","id":"ignored","slides":[{"lines":["첫째 문장"],"label":"새 이름표","future":{"__proto__":{"kept":true}}}]}}',
    );
    const parsed = expectSuccess(parseTextImportPreviewResult(result));
    const future: unknown = JSON.parse('{"__proto__":{"kept":true}}');
    expect(parsed).toEqual({
      ok: true,
      value: {
        title: '',
        slides: [
          {
            lines: ['첫째 문장'],
            label: '새 이름표',
            future,
          },
        ],
      },
    });
  });

  it.each([
    {ok: true, value: null},
    ...['intro', -1, 0.5].map(section => ({
      ok: true,
      value: {title: 'Invented', slides: [{lines: [], section}]},
    })),
    {ok: true, value: {title: '', slides: []}},
    {ok: true, value: {title: 1, slides: [{lines: []}]}},
    {ok: true, value: {title: '', slides: [{lines: [1]}]}},
    {ok: true, value: {title: '', slides: [[]]}},
    {ok: false, error: {reason: 'empty'}},
    [],
  ])('rejects malformed draft results %j', result => {
    expect(parseTextImportPreviewResult(result).ok).toBe(false);
  });

  it('accepts a conversion refusal without inventing a draft', () => {
    const result = {ok: false, error: {reason: 'empty', message: 'No lyrics'}};
    expect(expectSuccess(parseTextImportPreviewResult(result))).toEqual(result);
  });
});
