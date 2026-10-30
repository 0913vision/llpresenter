import {describe, expect, it} from 'vitest';
import {
  changeReferenceField,
  referenceFieldsState,
  selectedBook,
} from './referenceFields';

const fields = {book: '요', chapter: '3', start: '16', end: ''};
const bounds = {bookId: 43, chapterVerses: [8, 8, 36]};

describe('four-field Bible reference validation', () => {
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

  it('blocks Tab past the last verse but clamps the lookup endpoint', () => {
    expect(referenceFieldsState({...fields, end: '99'}, bounds)).toMatchObject({
      input: '요한복음 3:16-36',
      clampedEnd: 36,
      errors: {end: '끝절 범위 확인'},
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
