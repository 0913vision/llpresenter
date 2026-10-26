import {useEffect, useEffectEvent} from 'react';
import {isColumnDragActive} from '@renderer/state/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui/shortcutRecording';

/** A physical control-window key, after fields and popup surfaces take theirs. */
export interface WindowShortcut {
  readonly code: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  readonly when?: (event: KeyboardEvent) => boolean;
  readonly run: () => void;
}

function matches(event: KeyboardEvent, shortcut: WindowShortcut): boolean {
  return (
    event.code === shortcut.code &&
    event.ctrlKey === (shortcut.ctrl ?? false) &&
    event.altKey === (shortcut.alt ?? false) &&
    event.shiftKey === (shortcut.shift ?? false) &&
    !event.metaKey
  );
}

/** Keeps app commands below IME, modal, menu, recorder, and drag precedence. */
export function useWindowShortcuts(shortcuts: readonly WindowShortcut[]): void {
  const run = useEffectEvent((event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      isColumnDragActive() ||
      modalStack.isOpen ||
      document.querySelector('[role="menu"]') !== null ||
      (event.target instanceof Element &&
        event.target.closest(SHORTCUT_RECORDING_SELECTOR) !== null)
    ) {
      return;
    }
    const command = shortcuts.find(shortcut => matches(event, shortcut));
    if (command === undefined || command.when?.(event) === false) return;
    event.preventDefault();
    if (!event.repeat) command.run();
  });
  useEffect(() => {
    let composing = false;
    let dragging = false;
    const startComposition = (): void => {
      composing = true;
    };
    const endComposition = (): void => {
      composing = false;
    };
    const startDrag = (): void => {
      dragging = true;
    };
    const endDrag = (): void => {
      dragging = false;
    };
    const reset = (): void => {
      endComposition();
      endDrag();
    };
    const keyDown = (event: KeyboardEvent): void => {
      if (!composing && !dragging) run(event);
    };
    window.addEventListener('compositionstart', startComposition, true);
    window.addEventListener('compositionend', endComposition, true);
    window.addEventListener('dragstart', startDrag, true);
    window.addEventListener('dragend', endDrag, true);
    window.addEventListener('drop', endDrag, true);
    window.addEventListener('blur', reset);
    window.addEventListener('keydown', keyDown);
    return () => {
      window.removeEventListener('compositionstart', startComposition, true);
      window.removeEventListener('compositionend', endComposition, true);
      window.removeEventListener('dragstart', startDrag, true);
      window.removeEventListener('dragend', endDrag, true);
      window.removeEventListener('drop', endDrag, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('keydown', keyDown);
    };
  }, []);
}
