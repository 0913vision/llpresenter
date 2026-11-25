import {create} from 'zustand';
import {useEffect} from 'react';
import {outputNext, outputTile} from '@renderer/session/show/show';
import {textBoxHasKey} from '@renderer/ui/fields/textEntry';
import {modalStack} from '@renderer/ui/popups/modalStack';
import {focusSlideGrid} from '../focusSlideGrid';
import {serviceSlideAt} from '../serviceSlideNumbers';
import {isColumnDragActive} from '@renderer/ui/panels/columnDrag';
import {useShow} from '@renderer/session/show/showStore';

/** The digits typed so far for a slide number, empty when none. */
export const useNumberJump = create<{value: string}>(() => ({value: ''}));
function clear(): void {
  useNumberJump.setState({value: ''});
}

const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];
const SURFACES = '[role="menu"], [role="dialog"], [role="alertdialog"]';

/**
 * Whether the number jump hears this key: not while Korean is composing, a
 * text box has the focus, a column is dragged, or a menu or dialog is open.
 */
function hearsKey(event: KeyboardEvent): boolean {
  return !(
    event.defaultPrevented ||
    isColumnDragActive() ||
    event.isComposing ||
    event.key === 'Process' ||
    textBoxHasKey(event.target) ||
    modalStack.isOpen ||
    (event.target instanceof Element &&
      event.target.closest(SURFACES) !== null) ||
    [...document.querySelectorAll(SURFACES)].some(
      surface => surface.closest('[inert]') === null,
    )
  );
}

/** What a key does to the digits typed so far. */
type NumberJumpStep =
  | {readonly kind: 'type'; readonly value: string}
  | {readonly kind: 'go'; readonly number: number}
  | {readonly kind: 'next-slide'}
  | {readonly kind: 'erase'; readonly value: string}
  | {readonly kind: 'drop'; readonly consumed: boolean}
  | {readonly kind: 'none'};

/**
 * What a key does to the typed digits `value`: a digit adds to them, Enter
 * goes to that slide (or, with no digits and the grid or nothing focused, to
 * the next slide, as in a PowerPoint show), Backspace erases one, Delete and
 * Esc drop them, and any other key drops them without taking the key.
 */
export function numberJumpStep(
  value: string,
  {
    key,
    modified,
    onGrid,
  }: {
    readonly key: string;
    /** Ctrl, Alt, Meta or Shift is down. */
    readonly modified: boolean;
    /** The slide grid, or nothing, has the focus. */
    readonly onGrid: boolean;
  },
): NumberJumpStep {
  const modifierOnly = MODIFIERS.includes(key);
  if (modified) {
    return value !== '' && !modifierOnly
      ? {kind: 'drop', consumed: false}
      : {kind: 'none'};
  }
  if (/^\d$/u.test(key)) {
    return {kind: 'type', value: (value + key).slice(0, 15)};
  }
  if (value === '') {
    return key === 'Enter' && onGrid ? {kind: 'next-slide'} : {kind: 'none'};
  }
  if (key === 'Enter') return {kind: 'go', number: Number(value)};
  if (key === 'Delete' || key === 'Escape') {
    return {kind: 'drop', consumed: true};
  }
  if (key === 'Backspace') return {kind: 'erase', value: value.slice(0, -1)};
  return modifierOnly ? {kind: 'none'} : {kind: 'drop', consumed: false};
}

function onSlideGrid(target: EventTarget | null): boolean {
  return (
    target === document.body ||
    (target instanceof Element &&
      target.closest('[data-show-slide-grid="true"]') !== null)
  );
}

/** Runs before focused slide grids and numeric slide hotkeys. */
export function handleNumberJump(event: KeyboardEvent): void {
  const value = useNumberJump.getState().value;
  if (!hearsKey(event)) {
    if (value) clear();
    return;
  }
  const step = numberJumpStep(value, {
    key: event.key,
    modified: event.ctrlKey || event.altKey || event.metaKey || event.shiftKey,
    onGrid: onSlideGrid(event.target),
  });
  if (step.kind === 'none') return;
  if (step.kind === 'drop' && !step.consumed) {
    clear();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  switch (step.kind) {
    case 'type':
    case 'erase':
      useNumberJump.setState({value: step.value});
      return;
    case 'drop':
      clear();
      return;
    case 'next-slide':
      if (!event.repeat) outputNext();
      return;
    case 'go': {
      const cursor = serviceSlideAt(useShow.getState(), step.number);
      clear();
      if (cursor !== null) {
        outputTile(cursor);
        focusSlideGrid();
      }
      return;
    }
  }
}

/**
 * Collects typed digits while it is mounted and outputs the slide of that
 * number on Enter; Delete and Escape drop the digits.
 */
export function useNumberJumpKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleNumberJump, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', handleNumberJump, true);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, []);
}
