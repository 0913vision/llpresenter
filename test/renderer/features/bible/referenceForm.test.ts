import {describe, expect, it} from 'vitest';
import {EMPTY_REFERENCE} from '@core/bible';
import {
  numberPlaceholder,
  referenceKey,
  type ReferenceKeyEvent,
  type ReferenceKeyState,
} from '@renderer/features/bible/referenceForm';

const key = (
  name: string,
  more: Partial<ReferenceKeyEvent> = {},
): ReferenceKeyEvent => ({
  key: name,
  code: name,
  shift: false,
  command: false,
  repeat: false,
  composing: false,
  value: '',
  ...more,
});
const state = (more: Partial<ReferenceKeyState> = {}): ReferenceKeyState => ({
  dialogMode: false,
  expanded: false,
  escapes: false,
  submissionDisabled: false,
  highlightedBook: false,
  highlighted: false,
  pointed: -1,
  suggestions: 0,
  fields: EMPTY_REFERENCE,
  enabled: {start: true, end: true},
  error: false,
  ...more,
});

describe('a key in the reference form', () => {
  it('holds Tab while Korean composes in the book field', () => {
    expect(
      referenceKey(
        'book',
        key('Process', {code: 'Tab', composing: true}),
        state(),
      ),
    ).toEqual({kind: 'tab-after-composition'});
  });

  it('empties the dialog with Esc, then closes it', () => {
    const filled = {...EMPTY_REFERENCE, book: '요한복음'};
    expect(
      referenceKey(
        'book',
        key('Escape'),
        state({dialogMode: true, fields: filled}),
      ),
    ).toEqual({kind: 'clear'});
    expect(
      referenceKey('book', key('Escape'), state({dialogMode: true})),
    ).toEqual({kind: 'escape'});
  });

  it('goes back a field with Backspace in an empty dialog field', () => {
    expect(
      referenceKey('start', key('Backspace'), state({dialogMode: true})),
    ).toEqual({kind: 'focus', part: 'chapter'});
    expect(
      referenceKey('chapter', key('Backspace'), state({dialogMode: true})),
    ).toEqual({kind: 'focus', part: 'book'});
  });

  it('takes a whole reference typed in the book field', () => {
    expect(
      referenceKey('book', key('Enter', {value: '요 3:16'}), state()),
    ).toEqual({kind: 'full-reference', submit: true});
    expect(
      referenceKey('book', key('Tab', {value: '요 3:16'}), state()),
    ).toEqual({kind: 'full-reference', submit: false});
  });

  it('moves through the suggestions with the arrows', () => {
    expect(
      referenceKey(
        'book',
        key('ArrowDown'),
        state({pointed: 1, suggestions: 2}),
      ),
    ).toEqual({kind: 'point', index: 1});
    expect(referenceKey('book', key('ArrowUp'), state())).toEqual({
      kind: 'point',
      index: -1,
    });
  });

  it('jumps to 시작절 with a colon and to 끝절 with a dash or tilde', () => {
    expect(referenceKey('chapter', key(':'), state())).toEqual({
      kind: 'focus',
      part: 'start',
    });
    expect(referenceKey('start', key('～'), state())).toEqual({
      kind: 'focus',
      part: 'end',
    });
  });

  it('refuses a letter in a number field and passes a digit', () => {
    expect(referenceKey('chapter', key('a'), state())).toEqual({
      kind: 'refuse',
    });
    expect(referenceKey('chapter', key('3'), state())).toEqual({kind: 'pass'});
  });

  it('stays on a wrong field with Tab and submits with Enter once', () => {
    const typed = {...EMPTY_REFERENCE, book: '요한복음', chapter: '99'};
    expect(
      referenceKey('chapter', key('Tab'), state({fields: typed, error: true})),
    ).toEqual({kind: 'block'});
    expect(referenceKey('chapter', key('Enter'), state())).toEqual({
      kind: 'submit',
    });
    expect(
      referenceKey('chapter', key('Enter', {repeat: true}), state()),
    ).toEqual({kind: 'repeat'});
  });
});

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
