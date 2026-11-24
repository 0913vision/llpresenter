import {useState} from 'react';

/**
 * The list of books and recent passages under the 책 field: whether it is
 * open, the row it points at, and whether the keyboard pointed there (only
 * a row pointed by the keyboard decides the book whose chapters are read).
 */
export function useBookSuggestions() {
  const [open, setOpen] = useState(false);
  const [pointed, setPointed] = useState(-1);
  const [keyboardPointed, setKeyboardPointed] = useState<number | null>(null);
  return {
    open,
    pointed,
    keyboardPointed,
    show: (): void => setOpen(true),
    hide: (): void => setOpen(false),
    /** Opens the list again for a changed book, with no row pointed. */
    restart: (): void => {
      setPointed(-1);
      setKeyboardPointed(null);
      setOpen(true);
    },
    /** Closes the list after a recent passage was chosen. */
    dismiss: (): void => {
      setPointed(-1);
      setOpen(false);
    },
    pointByKey: (index: number): void => {
      setOpen(true);
      setPointed(index);
      setKeyboardPointed(index);
    },
    pointByPointer: (index: number): void => {
      setPointed(index);
      setKeyboardPointed(null);
    },
  };
}

/**
 * What useBookSuggestions returns: whether the list is open, the row pointed
 * at, and the calls that open, point and close it.
 */
export type BookSuggestions = ReturnType<typeof useBookSuggestions>;
