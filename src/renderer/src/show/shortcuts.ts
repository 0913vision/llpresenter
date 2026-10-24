import {useEffect} from 'react';
import {outputNext, outputPrevious} from '@renderer/state/show';

const NEXT_KEYS: ReadonlySet<string> = new Set(['ArrowRight', ' ']);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(['ArrowLeft']);
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function isHandledElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(EDITABLE_SELECTOR) !== null ||
    target.closest('[data-slide-grid]') !== null
  );
}

/** Handles the next and previous 장 keys. Text fields and the 장 grid keep their own keys. */
export function handleSlideKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || hasModifier(event)) return;
  if (isHandledElsewhere(event.target)) return;
  if (NEXT_KEYS.has(event.key)) {
    event.preventDefault();
    outputNext();
  } else if (PREVIOUS_KEYS.has(event.key)) {
    event.preventDefault();
    outputPrevious();
  }
}

/** Listens for the next and previous 장 keys while the 진행 workspace is shown. */
export function useSlideShortcuts(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleSlideKey);
    return () => window.removeEventListener('keydown', handleSlideKey);
  }, []);
}
