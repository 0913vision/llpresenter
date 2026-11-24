import type {ReferenceFields, ReferencePart} from '@core/bible';
import {fullReferenceCandidate, NUMBER_PARTS} from './referenceForm';

/** What a key does in a field of the form. */
export type ReferenceKey =
  /** The browser's own handling. */
  | {readonly kind: 'pass'}
  /** Tab while Korean is composing: the book moves on after it commits. */
  | {readonly kind: 'tab-after-composition'}
  /** Esc in the dialog: empty the fields, or close when they are empty. */
  | {readonly kind: 'clear'}
  | {readonly kind: 'close-suggestions'}
  | {readonly kind: 'escape'}
  /** Back to the book field from a 장 or 절 field. */
  | {readonly kind: 'to-book'}
  | {readonly kind: 'focus'; readonly part: ReferencePart}
  | {readonly kind: 'choose-highlighted'}
  /** The key does nothing here. */
  | {readonly kind: 'ignore'}
  | {readonly kind: 'full-reference'; readonly submit: boolean}
  | {readonly kind: 'point'; readonly index: number}
  | {readonly kind: 'advance-book'}
  /** A character that is not a digit in a 장 or 절 field. */
  | {readonly kind: 'refuse'}
  /** Tab out of a field whose value is wrong: stay and show why. */
  | {readonly kind: 'block'}
  | {readonly kind: 'submit'}
  | {readonly kind: 'repeat'};

/** A keydown reduced to the fields the reference form's key rules read. */
export interface ReferenceKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly shift: boolean;
  /** Alt, Ctrl or Meta is down. */
  readonly command: boolean;
  readonly repeat: boolean;
  readonly composing: boolean;
  /** The value of the field the key is in. */
  readonly value: string;
}

/**
 * What the reference form shows when a key is pressed, which decides what the
 * key does.
 */
export interface ReferenceKeyState {
  readonly dialogMode: boolean;
  /** The book suggestions are open. */
  readonly expanded: boolean;
  readonly escapes: boolean;
  readonly submissionDisabled: boolean;
  /** Whether the suggestion picked with the arrow keys is a book. */
  readonly highlightedBook: boolean;
  /** Whether a suggestion is picked with the arrow keys. */
  readonly highlighted: boolean;
  readonly pointed: number;
  readonly suggestions: number;
  readonly fields: ReferenceFields;
  readonly enabled: {readonly start: boolean; readonly end: boolean};
  readonly error: boolean;
}

const forward = (event: ReferenceKeyEvent): boolean =>
  event.key === 'Enter' || (event.key === 'Tab' && !event.shift);

/** Decides what a key does in a field of the reference form. */
export function referenceKey(
  part: ReferencePart,
  event: ReferenceKeyEvent,
  state: ReferenceKeyState,
): ReferenceKey {
  if (event.composing) {
    return part === 'book' &&
      !event.shift &&
      (event.key === 'Tab' || event.code === 'Tab')
      ? {kind: 'tab-after-composition'}
      : {kind: 'pass'};
  }
  if (event.command) return {kind: 'pass'};
  const {book, chapter, start, end} = state.fields;
  const values = [book, chapter, start, end];
  if (state.dialogMode && event.key === 'Escape') {
    return values.some(value => value !== '')
      ? {kind: 'clear'}
      : {kind: 'escape'};
  }
  if (
    state.dialogMode &&
    event.key === 'Backspace' &&
    event.value === '' &&
    part !== 'book'
  ) {
    const index = NUMBER_PARTS.indexOf(part);
    return {
      kind: 'focus',
      part: index <= 0 ? 'book' : (NUMBER_PARTS[index - 1] ?? 'book'),
    };
  }
  if (event.key === 'Escape' && state.expanded) {
    return {kind: 'close-suggestions'};
  }
  if (event.key === 'Escape' && state.escapes) return {kind: 'escape'};
  if (part === 'book') {
    if (
      state.expanded &&
      !event.repeat &&
      forward(event) &&
      state.highlightedBook
    ) {
      return {kind: 'choose-highlighted'};
    }
    if (event.key === 'Enter' && state.submissionDisabled) {
      return {kind: 'ignore'};
    }
    if (
      forward(event) &&
      !event.repeat &&
      fullReferenceCandidate(event.value) !== null
    ) {
      return {kind: 'full-reference', submit: event.key === 'Enter'};
    }
    // NOTE(0913vision): While the book list is open, Enter picks the book and
    // moves on to 장, as Tab does; it shows a passage only once 장 has a
    // value (user decision, November 21).
    if (
      event.key === 'Enter' &&
      !event.repeat &&
      state.expanded &&
      book.trim() !== '' &&
      chapter === ''
    ) {
      return {kind: 'advance-book'};
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      return {
        kind: 'point',
        index:
          event.key === 'ArrowDown'
            ? Math.min(state.pointed + 1, state.suggestions - 1)
            : Math.max(-1, state.pointed - 1),
      };
    }
    if (event.key === 'Tab' && !event.shift) {
      return state.fields.book.trim() === '' && !state.highlighted
        ? {kind: 'pass'}
        : {kind: 'advance-book'};
    }
  }
  if (event.key === 'Escape' && part !== 'book') return {kind: 'to-book'};
  if (part === 'chapter' && event.key === ':' && state.enabled.start) {
    return {kind: 'focus', part: 'start'};
  }
  if (part === 'start' && /^[-~～]$/u.test(event.key) && state.enabled.end) {
    return {kind: 'focus', part: 'end'};
  }
  if (part !== 'book' && event.key.length === 1 && !/^\d$/u.test(event.key)) {
    return {kind: 'refuse'};
  }
  if (
    event.key === 'Tab' &&
    !event.shift &&
    state.error &&
    values.some(value => value.trim() !== '')
  ) {
    return {kind: 'block'};
  }
  if (event.key !== 'Enter') return {kind: 'pass'};
  return event.repeat ? {kind: 'repeat'} : {kind: 'submit'};
}
