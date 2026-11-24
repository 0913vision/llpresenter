import type {KeyboardEvent} from 'react';
import type {ReferencePart} from '@core/bible';
import type {ReferenceKey} from './referenceKey';

/** What the 성경 구절 fields do for each key action `referenceKey` decides. */
export interface ReferenceKeyHandlers {
  /** The book is still composing: Tab completes it once the IME commits. */
  readonly tabAfterComposition: () => void;
  readonly focus: (part: ReferencePart) => void;
  /** Points the book suggestion at `index` by keyboard. */
  readonly point: (index: number) => void;
  readonly advanceBook: () => void;
  /** Shows the reason of `part` that a key could not get past. */
  readonly block: (part: ReferencePart) => void;
  readonly clear: () => void;
  readonly escape: () => void;
  readonly closeSuggestions: () => void;
  readonly toBook: () => void;
  readonly chooseHighlighted: () => void;
  readonly fullReference: (value: string, submit: boolean) => void;
  readonly submit: (part: ReferencePart) => void;
  /** A key that takes another way forgets the submit that was waiting. */
  readonly forgetSubmit: () => void;
}

/**
 * Runs the action `referenceKey` chose for a key in field `part`. Actions
 * that act keep the key from the browser and, where the window has a
 * shortcut for it, from the window too.
 */
export function runReferenceKey(
  {
    part,
    action,
    event,
  }: {
    readonly part: ReferencePart;
    readonly action: ReferenceKey;
    readonly event: KeyboardEvent<HTMLInputElement>;
  },
  handlers: ReferenceKeyHandlers,
): void {
  /** Keeps the key from the browser and from the window. */
  const take = (): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  switch (action.kind) {
    case 'pass':
      return;
    case 'tab-after-composition':
      event.preventDefault();
      handlers.tabAfterComposition();
      return;
    case 'focus':
      event.preventDefault();
      handlers.focus(action.part);
      return;
    case 'point':
      event.preventDefault();
      handlers.point(action.index);
      return;
    case 'advance-book':
      event.preventDefault();
      handlers.advanceBook();
      return;
    case 'refuse':
      event.preventDefault();
      return;
    case 'block':
      event.preventDefault();
      handlers.block(part);
      return;
    case 'clear':
      take();
      handlers.forgetSubmit();
      handlers.clear();
      return;
    case 'escape':
      take();
      handlers.forgetSubmit();
      handlers.escape();
      return;
    case 'close-suggestions':
      take();
      handlers.forgetSubmit();
      handlers.closeSuggestions();
      return;
    case 'to-book':
      take();
      handlers.forgetSubmit();
      handlers.toBook();
      return;
    case 'choose-highlighted':
      take();
      handlers.chooseHighlighted();
      return;
    case 'full-reference':
      take();
      handlers.fullReference(event.currentTarget.value, action.submit);
      return;
    case 'submit':
      take();
      handlers.submit(part);
      return;
    case 'ignore':
    case 'repeat':
      take();
      return;
  }
}
