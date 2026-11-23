import type {ClipboardEvent} from 'react';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {
  addReason,
  copySelected,
  deleteSelected,
  pasteInto,
  selectionReason,
} from './deckCommands';
import type {SlideDeck} from './slideDeck';

/**
 * 복사, 잘라내기 and 붙여넣기 of whole slides on a list of slides, as plain
 * text. In a text field the field's own clipboard works instead.
 */
export function useDeckClipboard(deck: SlideDeck, focusSurface: () => void) {
  return {
    onCopy: (event: ClipboardEvent<HTMLElement>): void => {
      if (isInTextEntry(event.target)) return;
      const text = copySelected(deck);
      if (text === null) return;
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData('text/plain', text);
    },
    onCut: (event: ClipboardEvent<HTMLElement>): void => {
      if (isInTextEntry(event.target)) return;
      const text = copySelected(deck);
      if (text === null || selectionReason(deck) !== undefined) return;
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData('text/plain', text);
      focusSurface();
      deleteSelected(deck);
    },
    onPaste: (event: ClipboardEvent<HTMLElement>): void => {
      if (isInTextEntry(event.target) || addReason(deck) !== undefined) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      focusSurface();
      pasteInto(deck, event.clipboardData.getData('text/plain'));
    },
  };
}
