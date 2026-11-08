import {describe, expect, it} from 'vitest';
import {
  changeReferenceField,
  EMPTY_REFERENCE,
  reconcileReferenceFields,
  referenceFieldsState,
  selectedBook,
} from '@core/bible/referenceFields';

const fields = {book: '요', chapter: '3', start: '16', end: ''};
const bounds = {bookId: 43, chapterVerses: [8, 8, 36]};

describe('four-field Bible reference validation', () => {
  it('enables each field only after its prerequisite is valid', () => {
    const enabled = (value: typeof fields, limits = bounds) =>
      referenceFieldsState(value, limits).enabled;
    expect(enabled(EMPTY_REFERENCE)).toEqual({
      book: true,
      chapter: false,
      start: false,
      end: false,
    });
    expect(enabled({...EMPTY_REFERENCE, book: '요'})).toEqual({
      book: true,
      chapter: true,
      start: false,
      end: false,
    });
    expect(enabled({...fields, start: ''})).toEqual({
      book: true,
      chapter: true,
      start: true,
      end: false,
    });
    expect(enabled(fields)).toEqual({
      book: true,
      chapter: true,
      start: true,
      end: true,
    });
    expect(referenceFieldsState(fields, undefined).enabled).toEqual({
      book: true,
      chapter: true,
      start: false,
      end: false,
    });
  });

  it('clears only descendants of invalid prerequisites, including newly loaded bounds', () => {
    const range = {...fields, end: '18'};
    expect(changeReferenceField(range, 'book', '베')).toEqual({
      book: '베',
      chapter: '',
      start: '',
      end: '',
    });
    expect(changeReferenceField(range, 'chapter', '22')).toEqual({
      ...range,
      chapter: '22',
      start: '',
      end: '',
    });
    expect(changeReferenceField(range, 'chapter', '')).toEqual({
      ...range,
      chapter: '',
      start: '',
      end: '',
    });
    expect(
      reconcileReferenceFields(
        changeReferenceField(range, 'chapter', '2'),
        bounds,
      ),
    ).toEqual({
      ...range,
      chapter: '2',
      end: '',
    });
    expect(
      reconcileReferenceFields(range, {bookId: 43, chapterVerses: [8, 8, 8]}),
    ).toEqual({...range, end: ''});
    expect(
      reconcileReferenceFields(range, {bookId: 43, chapterVerses: [8]}),
    ).toEqual({...range, start: '', end: ''});
    expect(reconcileReferenceFields(range, undefined)).toBe(range);
    expect(reconcileReferenceFields(range, {...bounds, bookId: 1})).toBe(range);
  });

  it.each(['chapter', 'start', 'end'] as const)(
    'rejects non-digit %s edits without changing the range',
    part => {
      const range = {...fields, end: '18'};
      for (const value of [
        '-1',
        '1.5',
        '+2',
        '1e2',
        ' 3',
        '3 ',
        '１',
        '가',
        '2\n3',
      ]) {
        expect(changeReferenceField(range, part, value)).toBe(range);
      }
      expect(changeReferenceField(range, part, '')[part]).toBe('');
      expect(changeReferenceField(range, part, '01')[part]).toBe('01');
    },
  );

  it('accepts an exact or unique book and leaves ambiguity unselected', () => {
    expect(selectedBook('요')?.id).toBe(43);
    expect(selectedBook('ckdtp')?.id).toBe(1);
    expect(selectedBook('베')).toBeUndefined();
    expect(selectedBook('')).toBeUndefined();
  });

  it('treats an empty end as one verse and normalizes ranges', () => {
    expect(referenceFieldsState(fields, bounds)).toMatchObject({
      input: '요한복음 3:16',
      errors: {
        book: undefined,
        chapter: undefined,
        start: undefined,
        end: undefined,
      },
    });
    expect(referenceFieldsState({...fields, end: '18'}, bounds).input).toBe(
      '요한복음 3:16-18',
    );
    expect(referenceFieldsState({...fields, end: '16'}, bounds).input).toBe(
      '요한복음 3:16',
    );
  });

  it.each(['', '0', '-1', '1.5', 'x', '22', '9007199254740992'])(
    'blocks an invalid chapter %j',
    chapter => {
      const state = referenceFieldsState({...fields, chapter}, bounds);
      expect(state.errors.chapter).toBeDefined();
      expect(state.input).toBe('');
    },
  );

  it.each(['', '0', '-1', '1.5', '37', 'x'])(
    'blocks an invalid start %j',
    start => {
      const state = referenceFieldsState({...fields, start}, bounds);
      expect(state.errors.start).toBeDefined();
      expect(state.input).toBe('');
    },
  );

  it.each(['0', '-1', '1.5', '15', 'x'])('blocks an invalid end %j', end => {
    const state = referenceFieldsState({...fields, end}, bounds);
    expect(state.errors.end).toBeDefined();
    expect(state.input).toBe('');
  });

  it('tells an invalid value apart from bounds that are still loading', () => {
    expect(
      referenceFieldsState({...fields, chapter: '22'}, bounds).errors.chapter,
    ).toBe('장을 확인해야 합니다');
    expect(referenceFieldsState(fields, undefined).errors.chapter).toBe(
      '장 정보 불러오는 중',
    );
  });

  it('blocks Tab past the last verse but clamps the lookup endpoint', () => {
    expect(referenceFieldsState({...fields, end: '99'}, bounds)).toMatchObject({
      input: '요한복음 3:16-36',
      clampedEnd: 36,
      errors: {end: '끝절을 확인해야 합니다'},
    });
  });

  it('rejects stale book bounds and waits for installed translation metadata', () => {
    expect(referenceFieldsState(fields, undefined).input).toBe('');
    expect(referenceFieldsState(fields, {...bounds, bookId: 1}).input).toBe('');
    expect(referenceFieldsState({...fields, chapter: '4'}, bounds).input).toBe(
      '',
    );
  });

  it('clears the end only when the start changes', () => {
    const range = {...fields, end: '18'};
    expect(changeReferenceField(range, 'start', '17').end).toBe('');
    expect(changeReferenceField(range, 'start', '16')).toBe(range);
    expect(changeReferenceField(range, 'chapter', '2').end).toBe('18');
  });
});
