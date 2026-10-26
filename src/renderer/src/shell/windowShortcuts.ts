import {useEffect, useEffectEvent} from 'react';
import {isColumnDragActive} from '@renderer/state/drag';
import {modalStack} from '@renderer/ui/modalStack';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui/shortcutRecording';

const POINTER_DRAG_THRESHOLD_PX = 4;

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
    let pointer: {id: number; x: number; y: number; dragged: boolean} | null =
      null;
    const pointerDown = (event: PointerEvent): void => {
      if (event.button === 0) {
        pointer = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          dragged: false,
        };
      }
    };
    const pointerMove = (event: PointerEvent): void => {
      if (pointer?.id !== event.pointerId) return;
      pointer.dragged ||=
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >
        POINTER_DRAG_THRESHOLD_PX;
    };
    const pointerEnd = (): void => {
      pointer = null;
    };
    const cancelPointer = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') pointerEnd();
    };
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
      pointerEnd();
    };
    const keyDown = (event: KeyboardEvent): void => {
      if (!composing && !dragging && pointer?.dragged !== true) run(event);
    };
    window.addEventListener('compositionstart', startComposition, true);
    window.addEventListener('compositionend', endComposition, true);
    window.addEventListener('dragstart', startDrag, true);
    window.addEventListener('dragend', endDrag, true);
    window.addEventListener('drop', endDrag, true);
    window.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('pointermove', pointerMove, true);
    window.addEventListener('pointerup', pointerEnd, true);
    window.addEventListener('pointercancel', pointerEnd, true);
    window.addEventListener('lostpointercapture', pointerEnd, true);
    window.addEventListener('keydown', cancelPointer, true);
    window.addEventListener('blur', reset);
    window.addEventListener('keydown', keyDown);
    return () => {
      window.removeEventListener('compositionstart', startComposition, true);
      window.removeEventListener('compositionend', endComposition, true);
      window.removeEventListener('dragstart', startDrag, true);
      window.removeEventListener('dragend', endDrag, true);
      window.removeEventListener('drop', endDrag, true);
      window.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerEnd, true);
      window.removeEventListener('pointercancel', pointerEnd, true);
      window.removeEventListener('lostpointercapture', pointerEnd, true);
      window.removeEventListener('keydown', cancelPointer, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('keydown', keyDown);
    };
  }, []);
}
