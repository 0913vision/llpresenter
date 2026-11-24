import {useImperativeHandle, type Ref, type RefObject} from 'react';
import {referenceFieldsState, type ReferencePart} from '@core/bible';
import type {
  BibleLookupPassage,
  BibleLookupReply,
} from '@core/schema/bible/bibleLookup';
import {
  focusPart,
  fullReferenceCandidate,
  readReferenceFields,
} from './referenceForm';
import type {BookSuggestions} from './useBookSuggestions';
import {usePendingSubmit, type PendingSubmit} from './usePendingSubmit';
import type {ReferenceEntry} from './useReferenceEntry';
import type {ReferenceLookups} from './useReferenceLookups';

/**
 * Sends the passage of a reference form. A passage whose lookup is back goes
 * at once; one asked for while its lookup runs goes when it comes back; one
 * that can't be found marks the field it was sent from.
 */
export function useReferenceSubmit({
  root,
  entry,
  lookups,
  suggestions,
  hasTranslation,
  submissionDisabled,
  submitRef,
  onSubmit,
  onIntent,
  onEdit,
}: {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly entry: ReferenceEntry;
  readonly lookups: ReferenceLookups;
  readonly suggestions: BookSuggestions;
  /** Whether the form was given a translation to read. */
  readonly hasTranslation: boolean;
  /** Whether the form's owner sends nothing now. */
  readonly submissionDisabled: boolean;
  readonly submitRef: Ref<{submit: () => void}> | undefined;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onIntent: (() => void) | undefined;
  readonly onEdit:
    ((equivalent: BibleLookupPassage | null) => void) | undefined;
}) {
  const {fields, setFields, setBlocked, setRecent, translation} = entry;
  const {reply, passage, bounds} = lookups;

  const send = (sent: BibleLookupPassage, clampedEnd?: number): void => {
    if (clampedEnd !== undefined) {
      setFields(previous => ({...previous, end: String(clampedEnd)}));
    }
    suggestions.hide();
    onSubmit(sent);
  };
  const settle = (
    pending: PendingSubmit,
    result: BibleLookupReply['result'],
  ): void => {
    if (result.ok) send(result.value, pending.clampedEnd);
    else setBlocked(pending.part);
  };
  const pendingSubmit = usePendingSubmit({
    reply,
    input: lookups.input,
    translation,
    settle,
  });

  /** Sends what the fields say, from the field that Enter was pressed in. */
  const submit = (part: ReferencePart): void => {
    if (!hasTranslation || submissionDisabled) return;
    if (lookups.chapterInput !== null && translation !== undefined) {
      const input = lookups.chapterInput;
      setRecent({ref: input, translation});
      pendingSubmit.wait({input, translation, clampedEnd: undefined, part});
      return;
    }
    // NOTE(0913vision): The last change can still be batched while the lookup
    // and its rendered result refer to the previous value.
    const current = readReferenceFields(root.current, fields);
    const currentState = referenceFieldsState(current, bounds);
    const input = entry.recent?.ref ?? currentState.input;
    const clampedEnd = current.end === '' ? undefined : currentState.clampedEnd;
    if (passage && reply?.input === input) {
      pendingSubmit.forget();
      send(passage, clampedEnd);
    } else if (
      translation !== undefined &&
      input !== '' &&
      reply?.input !== input
    ) {
      pendingSubmit.wait({input, translation, clampedEnd, part});
    } else {
      setBlocked(part);
    }
  };

  /**
   * Takes a whole reference typed in the 책 field into the fields, and sends
   * it when asked to; else the caret moves on to where the operator goes on.
   *
   * @returns Whether the value was a whole reference.
   */
  const acceptFullReference = (value: string, submitNow: boolean): boolean => {
    const candidate = fullReferenceCandidate(value);
    if (candidate === null) return false;
    const {reference, next, parsedState, input, invalidPart} = candidate;
    onIntent?.();
    onEdit?.(null);
    setRecent(
      reference.verse === null && input && translation !== undefined
        ? {ref: input, translation}
        : null,
    );
    setFields(next);
    suggestions.hide();
    setBlocked(input ? null : invalidPart);
    if (submitNow && input && translation !== undefined) {
      const pending = {
        input,
        translation,
        clampedEnd: parsedState.clampedEnd,
        part: 'end' as const,
      };
      const {ahead} = lookups;
      if (ahead?.input === input && ahead.translation === translation) {
        settle(pending, ahead.result);
      } else {
        pendingSubmit.wait(pending);
      }
    } else {
      pendingSubmit.forget();
      queueMicrotask(() =>
        focusPart(root.current, input ? 'end' : invalidPart),
      );
    }
    return true;
  };

  useImperativeHandle(submitRef, () => ({
    submit: () => {
      if (submissionDisabled) return;
      const book = readReferenceFields(root.current, fields).book;
      if (!acceptFullReference(book, true)) submit('book');
    },
  }));
  return {submit, acceptFullReference, forget: pendingSubmit.forget};
}

export type ReferenceSubmit = ReturnType<typeof useReferenceSubmit>;
