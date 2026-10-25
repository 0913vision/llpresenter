import {
  useCallback,
  useLayoutEffect,
  useRef,
  type PointerEventHandler,
} from 'react';
import type {Workspace} from './workspace';

interface PointerEnd {
  readonly pointerId: number;
}

interface PointerInteraction {
  readonly controller: AbortController;
  readonly finish: (event: PointerEnd) => void;
}

interface SliderPointerOptions {
  readonly workspace: Workspace;
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
  readonly onLostPointerCapture: PointerEventHandler<HTMLInputElement>;
} {
  const interaction = useRef<PointerInteraction | null>(null);
  const commit = useRef(onCommit);
  useLayoutEffect(() => {
    commit.current = onCommit;
  }, [onCommit]);
  const clear = useCallback((): void => {
    interaction.current?.controller.abort();
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
    const finish = (end: PointerEnd): void => {
      if (end.pointerId !== pointerId || interaction.current === null) {
        return;
      }
      const value = input.valueAsNumber;
      clear();
      if (workspace === 'show' && document.activeElement === input) {
        if (
          previous instanceof HTMLElement &&
          previous.isConnected &&
          previous !== document.body
        ) {
          previous.focus({preventScroll: true});
        } else {
          input.blur();
        }
      }
      commit.current?.(value);
    };
    interaction.current = {controller, finish};
    // NOTE(0913vision): Chromium can drop a range's pointer capture on mousedown,
    // so its release can target an element outside the input.
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
    onLostPointerCapture: event => interaction.current?.finish(event),
  };
}
