import {useLayoutEffect, useState, type KeyboardEvent} from 'react';
import {isComposing} from './ime';

export interface InputCompletion {
  readonly input: string;
  readonly caret: number;
}

export function useInputCompletion(onChange: (input: string) => void) {
  const [selection, setSelection] = useState<{
    readonly field: HTMLInputElement;
    readonly caret: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (selection?.field.isConnected) {
      selection.field.setSelectionRange(selection.caret, selection.caret);
    }
  }, [selection]);
  return (
    event: KeyboardEvent<HTMLInputElement>,
    result: InputCompletion | null,
  ): boolean => {
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      isComposing(event) ||
      result === null
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) {
      onChange(result.input);
      setSelection({field: event.currentTarget, caret: result.caret});
    }
    return true;
  };
}
