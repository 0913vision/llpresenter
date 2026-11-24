import {
  useCallback,
  useLayoutEffect,
  useRef,
  type PointerEventHandler,
} from 'react';
import type {ListWorkspace} from '../lists/workspace';
import {returnFocus} from '../keys/returnFocus';

interface SliderPointerOptions {
  readonly workspace: ListWorkspace;
  readonly disabled: boolean;
  readonly onCommit: ((value: number) => void) | undefined;
}

/** Completes native range drags even when the pointer ends outside the input. */
export function useSliderPointer({
  workspace,
  disabled,
  onCommit,
}: SliderPointerOptions): {
  readonly onPointerDown: PointerEventHandler<HTMLInputElement>;
} {
  const interaction = useRef<AbortController | null>(null);
  const commit = useRef(onCommit);
  useLayoutEffect(() => {
    commit.current = onCommit;
  }, [onCommit]);
  const clear = useCallback((): void => {
    interaction.current?.abort();
    interaction.current = null;
  }, []);
  useLayoutEffect(() => clear, [clear, workspace, disabled]);

  const onPointerDown: PointerEventHandler<HTMLInputElement> = event => {
    if (disabled || event.button !== 0) return;
    clear();
    if (workspace !== 'show' && onCommit === undefined) return;
    const input = event.currentTarget;
    const previous = document.activeElement;
    const pointerId = event.pointerId;
    const controller = new window.AbortController();
    const finish = (end: PointerEvent): void => {
      if (end.pointerId !== pointerId || interaction.current !== controller) {
        return;
      }
      const value = input.valueAsNumber;
      clear();
      if (workspace === 'show' && document.activeElement === input) {
        if (
          previous instanceof HTMLElement &&
          previous.isConnected &&
          previous !== document.body &&
          previous !== input &&
          (previous.closest(
            '[data-show-slide-grid], [data-panel="예배 순서"] [role="listbox"]',
          ) !== null ||
            document.querySelector('[data-workspace-layout="show"]') === null)
        ) {
          previous.focus({preventScroll: true});
        } else {
          returnFocus(null);
          if (document.activeElement === input) input.blur();
        }
      }
      commit.current?.(value);
    };
    interaction.current = controller;
    // NOTE(0913vision): Capture loss can precede release. Track completion on
    // the window independently of pointer capture.
    const options = {capture: true, signal: controller.signal};
    window.addEventListener('pointerup', finish, options);
    window.addEventListener('pointercancel', finish, options);
    window.addEventListener(
      'blur',
      () => {
        const value = input.valueAsNumber;
        clear();
        commit.current?.(value);
      },
      {signal: controller.signal},
    );
    input.setPointerCapture(pointerId);
  };

  return {
    onPointerDown,
  };
}
