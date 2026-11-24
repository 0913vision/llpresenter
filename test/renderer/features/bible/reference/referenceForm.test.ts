import {describe, expect, it} from 'vitest';
import {
  fieldReason,
  numberPlaceholder,
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
      '불러오는 중...',
    );
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
