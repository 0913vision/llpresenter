import {create} from 'zustand';
import {useEffect} from 'react';
import {outputNext, outputTile, useShow} from '@renderer/session/show';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {modalStack} from '@renderer/ui/popups/modalStack';
import {focusSlideGrid} from '../focusSlideGrid';
import {serviceSlideAt} from '../serviceSlideNumbers';
import {isColumnDragActive} from '@renderer/ui/panels/columnDrag';

export const useNumberJump = create<{value: string}>(() => ({value: ''}));
const clear = (): void => useNumberJump.setState({value: ''});

function textEntry(target: EventTarget | null): boolean {
  if (
    target instanceof HTMLInputElement &&
    [
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'range',
      'color',
      'file',
      'image',
    ].includes(target.type)
  ) {
    return false;
  }
  return isInTextEntry(target);
}

/** Runs before focused slide grids and numeric slide hotkeys. */
export function handleNumberJump(event: KeyboardEvent): void {
  const value = useNumberJump.getState().value;
  if (
    event.defaultPrevented ||
    isColumnDragActive() ||
    event.isComposing ||
    event.key === 'Process' ||
    textEntry(event.target) ||
    modalStack.isOpen ||
    (event.target instanceof Element &&
      event.target.closest(
        '[role="menu"], [role="dialog"], [role="alertdialog"]',
      )) ||
    [
      ...document.querySelectorAll(
        '[role="menu"], [role="dialog"], [role="alertdialog"]',
      ),
    ].some(surface => surface.closest('[inert]') === null)
  ) {
    if (value) clear();
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    if (value && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      clear();
    }
    return;
  }
  if (/^\d$/u.test(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    useNumberJump.setState({value: (value + event.key).slice(0, 15)});
    return;
  }
  if (!value) {
    // NOTE(0913vision): Like a PowerPoint show, Enter and the keypad Enter
    // output the next slide while the slide grid or nothing has focus.
    if (
      event.key === 'Enter' &&
      (event.target === document.body ||
        (event.target instanceof Element &&
          event.target.closest('[data-show-slide-grid="true"]') !== null))
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) outputNext();
    }
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    const cursor = serviceSlideAt(useShow.getState(), Number(value));
    clear();
    if (cursor !== null) {
      outputTile(cursor);
      focusSlideGrid();
    }
  } else if (event.key === 'Delete' || event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    clear();
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    event.stopPropagation();
    useNumberJump.setState({value: value.slice(0, -1)});
  } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
    clear();
  }
}

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
