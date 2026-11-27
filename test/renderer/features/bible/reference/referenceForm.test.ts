import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {translationIdSchema} from '@core/schema/common/ids';
import {findBibleBooks} from '@core/bible';
import {
  fieldReason,
  fieldsOfReference,
  fullReferenceCandidate,
  numberPlaceholder,
  referenceSuggestions,
} from '@renderer/features/bible/reference/referenceForm';

describe('the hint in an empty number field', () => {
  const base = {
    dialogMode: true,
    overlayLabels: false,
    chapters: 21,
    chapter: 3,
    lastVerse: 36,
    start: '',
  };

  it('shows the range in the dialog', () => {
    expect(numberPlaceholder('chapter', base)).toBe('1~21');
    expect(numberPlaceholder('end', {...base, start: '16'})).toBe('16~36');
    expect(numberPlaceholder('start', {...base, lastVerse: undefined})).toBe(
      '불러오는 중',
    );
  });

  it('names the verse fields, not 불러오는 중, after a chapter the book has not', () => {
    const past = {...base, chapter: 22, lastVerse: undefined};
    expect(numberPlaceholder('start', past)).toBe('시작절');
    expect(numberPlaceholder('end', past)).toBe('끝절');
  });

  it('shows the first and last verse beside the dialog', () => {
    const inline = {...base, dialogMode: false};
    expect(numberPlaceholder('start', inline)).toBe('1');
    expect(numberPlaceholder('end', inline)).toBe('36');
    expect(numberPlaceholder('chapter', inline)).toBe('장');
  });
});

describe('the reason a passage field shows', () => {
  const none = {
    book: undefined,
    chapter: undefined,
    start: undefined,
    end: undefined,
  };
  const base = {
    bookFound: true,
    lookup: undefined,
    blocked: null,
    errors: none,
  };
  const fields = {book: '요한복음', chapter: '3', start: '16', end: ''};

  it('names a book no name matches', () => {
    expect(
      fieldReason('book', {
        ...base,
        fields: {...fields, book: '없는책'},
        bookFound: false,
      }),
    ).toBe('입력한 이름과 일치하는 성경 책이 없습니다.');
    expect(fieldReason('book', {...base, fields})).toBeUndefined();
  });

  it('tells a verse the translation leaves out from one that failed', () => {
    expect(
      fieldReason('start', {...base, fields, lookup: {code: 'omitted'}}),
    ).toBe('이 역본에 없는 절');
    expect(fieldReason('start', {...base, fields, lookup: {code: 'io'}})).toBe(
      '구절 불러오기 실패',
    );
  });

  it('shows a field error once the field has a value or a key was stopped', () => {
    const errors = {...none, end: '끝 절이 시작 절보다 앞입니다.'};
    expect(fieldReason('end', {...base, fields, errors})).toBeUndefined();
    expect(fieldReason('end', {...base, fields, errors, blocked: 'end'})).toBe(
      errors.end,
    );
    expect(
      fieldReason('end', {...base, fields: {...fields, end: '2'}, errors}),
    ).toBe(errors.end);
  });
});

describe('the fields of a reference', () => {
  it('splits a typed reference into the four fields, leaving 끝절 empty for one verse', () => {
    expect(fieldsOfReference('요 3:16-18')).toEqual({
      book: '요한복음',
      chapter: '3',
      start: '16',
      end: '18',
    });
    expect(fieldsOfReference('요한복음 3:16')).toEqual({
      book: '요한복음',
      chapter: '3',
      start: '16',
      end: '',
    });
    expect(fieldsOfReference('시편 23')).toMatchObject({
      book: '시편',
      chapter: '23',
      start: '',
    });
  });

  it('opens empty for nothing or for text that is no reference', () => {
    const empty = {book: '', chapter: '', start: '', end: ''};
    expect(fieldsOfReference(undefined)).toEqual(empty);
    expect(fieldsOfReference('없는책 1:1')).toEqual(empty);
  });
});

describe('a whole reference typed in the 책 field', () => {
  it('fills a whole chapter from its first to its last verse', () => {
    const candidate = fullReferenceCandidate('시편 23');
    expect(candidate?.next).toEqual({
      book: '시편',
      chapter: '23',
      start: '1',
      end: '6',
    });
    expect(candidate?.input).toBe('시편 23');
  });

  it('points at the part that is out of range, and takes no reference across chapters', () => {
    expect(fullReferenceCandidate('요한복음 3:99')?.invalidPart).toBe('start');
    expect(fullReferenceCandidate('요한복음 3:16-4:2')).toBeNull();
    expect(fullReferenceCandidate('아무 글')).toBeNull();
  });
});

describe('the suggestions under the 책 field', () => {
  it('lists the books that match, then the recent passages without repeats', () => {
    const translation = v.parse(translationIdSchema, 'gae');
    const recents = [
      {ref: '요한복음 3:16', translation},
      {ref: '요한복음 3:16', translation},
      {ref: '시편 23', translation},
    ];

    const suggestions = referenceSuggestions(
      findBibleBooks('요한'),
      recents,
      translation,
    );

    expect(suggestions.map(item => [item.group, item.input])).toEqual([
      ...findBibleBooks('요한').map(book => ['책', book.korean]),
      ['최근', '요한복음 3:16'],
      ['최근', '시편 23'],
    ]);
  });
});
