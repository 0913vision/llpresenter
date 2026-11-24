import type {KeyboardEvent, RefObject} from 'react';
import type {ReferencePart} from '@core/bible';
import {isComposing} from '@renderer/ui/fields/ime';
import {focusPart, referenceKey} from './referenceForm';
import type {ReferenceEdits} from './useReferenceEdits';
import {runReferenceKey} from './referenceKeyActions';
import type {BookSuggestions} from './useBookSuggestions';
import type {ReferenceEntry} from './useReferenceEntry';
import type {ReferenceLookups} from './useReferenceLookups';
import type {ReferenceSubmit} from './useReferenceSubmit';
import type {BibleSuggestion} from './bibleSuggestion';

/** Focuses the 책 field of a form. */
export function focusBook(root: HTMLElement | null): void {
  root?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus();
}

/**
 * The keys of a reference form's fields: what each key means in which field
 * is decided by referenceKey, and done here.
 */
export function useReferenceKeyDown({
  root,
  entry,
  lookups,
  suggestions,
  items,
  expanded,
  edits,
  submitting,
  dialogMode,
  submissionDisabled,
  onEscape,
  onTabWhileComposing,
}: {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly entry: ReferenceEntry;
  readonly lookups: ReferenceLookups;
  readonly suggestions: BookSuggestions;
  /** The rows of the book list. */
  readonly items: readonly BibleSuggestion[];
  /** Whether the book list shows. */
  readonly expanded: boolean;
  readonly edits: ReferenceEdits;
  readonly submitting: ReferenceSubmit;
  readonly dialogMode: boolean;
  readonly submissionDisabled: boolean;
  readonly onEscape: (() => void) | undefined;
  /** Notes a Tab pressed while Korean input still composes the book. */
  readonly onTabWhileComposing: () => void;
}): (part: ReferencePart, event: KeyboardEvent<HTMLInputElement>) => void {
  const highlighted = items[suggestions.keyboardPointed ?? -1];
  const handlers = {
    tabAfterComposition: onTabWhileComposing,
    focus: (part: ReferencePart) => focusPart(root.current, part),
    point: suggestions.pointByKey,
    advanceBook: edits.advanceBook,
    block: entry.setBlocked,
    clear: edits.clear,
    escape: () => onEscape?.(),
    closeSuggestions: suggestions.hide,
    toBook: () => {
      entry.setBlocked(null);
      focusBook(root.current);
    },
    chooseHighlighted: () => {
      if (highlighted !== undefined) edits.chooseSuggestion(highlighted);
    },
    fullReference: (value: string, submitNow: boolean) => {
      submitting.acceptFullReference(value, submitNow);
    },
    submit: submitting.submit,
    forgetSubmit: submitting.forget,
  };
  return (part, event) => {
    const action = referenceKey(
      part,
      {
        key: event.key,
        code: event.nativeEvent.code,
        shift: event.shiftKey,
        command: event.altKey || event.ctrlKey || event.metaKey,
        repeat: event.repeat,
        composing: isComposing(event),
        value: event.currentTarget.value,
      },
      {
        dialogMode,
        expanded,
        escapes: onEscape !== undefined,
        submissionDisabled,
        highlightedBook: highlighted?.bookId !== undefined,
        highlighted: highlighted !== undefined,
        pointed: suggestions.pointed,
        suggestions: items.length,
        fields: entry.fields,
        enabled: lookups.state.enabled,
        error: lookups.state.errors[part] !== undefined,
      },
    );
    runReferenceKey({part, event, action}, handlers);
  };
}
