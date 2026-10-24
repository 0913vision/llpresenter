import type {KeyboardEvent} from 'react';
import {isComposing} from './ime';
import {
  movePointer,
  typeaheadTarget,
  type MenuItem,
  type MenuMove,
} from './menuModel';

/** Why a menu closed: an item ran, Esc, a click outside, or Tab. */
export type MenuCloseReason = 'select' | 'escape' | 'outside' | 'tab';

/** What a key in a menu can do. */
export interface MenuKeyActions {
  readonly items: readonly MenuItem[];
  readonly pointed: number;
  readonly pointTo: (index: number) => void;
  readonly run: (index: number) => void;
  /**
   * Closes the submenu this menu has open, also one the pointer opened while
   * focus stayed here; `undefined` while none is open.
   */
  readonly closeChild: (() => void) | undefined;
  /** Closes only this submenu; `undefined` in a top-level menu. */
  readonly onBack: (() => void) | undefined;
  readonly onClose: (reason: MenuCloseReason) => void;
}

const keyMoves: Readonly<Record<string, MenuMove>> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
};

function isPrintable(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  );
}

function isCaretMove(move: MenuMove, inField: boolean): boolean {
  return inField && (move === 'first' || move === 'last');
}

function closeOneLevel({
  closeChild,
  onBack,
  onClose,
}: Pick<MenuKeyActions, 'closeChild' | 'onBack' | 'onClose'>): void {
  if (closeChild !== undefined) closeChild();
  else if (onBack !== undefined) onBack();
  else onClose('escape');
}

/**
 * Handles one key in a menu and reports whether the menu used it. In the
 * search field, keys that edit text stay with the field, and keys of an IME
 * composition stay with the IME.
 */
export function handleMenuKey(
  event: KeyboardEvent,
  actions: MenuKeyActions,
): boolean {
  if (isComposing(event)) return false;
  const {items, pointed, pointTo, run, closeChild, onBack, onClose} = actions;
  const inField = event.target instanceof HTMLInputElement;
  const move = keyMoves[event.key];
  if (move !== undefined && !isCaretMove(move, inField)) {
    pointTo(movePointer(items.length, pointed, move));
    return true;
  }
  switch (event.key) {
    case 'Enter':
      run(pointed);
      return true;
    case ' ':
      if (inField) return false;
      run(pointed);
      return true;
    case 'ArrowRight':
      if (inField || items[pointed]?.submenu === undefined) return false;
      run(pointed);
      return true;
    case 'ArrowLeft':
      if (inField || onBack === undefined) return false;
      onBack();
      return true;
    case 'Escape':
      closeOneLevel({closeChild, onBack, onClose});
      return true;
    case 'Tab':
      onClose('tab');
      return true;
    default: {
      if (inField || !isPrintable(event)) return false;
      const target = typeaheadTarget(items, pointed, event.key);
      if (target >= 0) pointTo(target);
      return true;
    }
  }
}
