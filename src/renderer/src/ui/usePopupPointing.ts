import {useLayoutEffect, useRef, type RefObject} from 'react';
import {isComposingKey} from './ime';

const CHOICE = '[data-choice], [role="option"], [role="radio"]';

function available(element: HTMLElement | null): boolean {
  return (
    element !== null && !element.matches(':disabled, [aria-disabled="true"]')
  );
}

/** Owns transient pointing attributes independently of selection and DOM focus. */
export function usePopupPointing(
  surface: RefObject<HTMLElement | null>,
  activeId: string | undefined,
): void {
  const pointed = useRef<HTMLElement | null>(null);
  const source = useRef<'keyboard' | 'pointer' | null>('keyboard');
  const active = useRef(activeId);
  useLayoutEffect(() => {
    active.current = activeId;
    if (pointed.current !== null && !available(pointed.current)) {
      pointed.current.removeAttribute('data-pointed');
      pointed.current = null;
    }
    if (source.current !== 'keyboard' || activeId === undefined) return;
    const target = document.getElementById(activeId);
    pointed.current?.removeAttribute('data-pointed');
    pointed.current =
      target !== null && available(target) && surface.current?.contains(target)
        ? target
        : null;
    pointed.current?.setAttribute('data-pointed', 'true');
  });
  useLayoutEffect(() => {
    const element = surface.current;
    if (element === null) return undefined;
    const choice = (target: EventTarget | null): HTMLElement | null => {
      const row =
        target instanceof Element ? target.closest<HTMLElement>(CHOICE) : null;
      return row !== null && available(row) && element.contains(row)
        ? row
        : null;
    };
    const point = (target: HTMLElement | null): void => {
      pointed.current?.removeAttribute('data-pointed');
      pointed.current = target;
      target?.setAttribute('data-pointed', 'true');
    };
    const hover = (event: PointerEvent): void => {
      source.current = 'pointer';
      point(choice(event.target));
    };
    const leave = (): void => {
      if (source.current !== 'pointer') return;
      source.current = null;
      point(null);
    };
    const out = (event: PointerEvent): void => {
      if (choice(event.target) !== choice(event.relatedTarget)) leave();
    };
    const keyboard = (event: KeyboardEvent): void => {
      const shiftedCommand =
        event.shiftKey && (event.key.length !== 1 || event.key === ' ');
      if (
        isComposingKey(event) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        shiftedCommand
      ) {
        return;
      }
      source.current = 'keyboard';
      if (!(event.target instanceof Node) || !element.contains(event.target)) {
        return;
      }
      point(
        choice(
          active.current === undefined
            ? document.activeElement
            : document.getElementById(active.current),
        ),
      );
    };
    const focus = (event: FocusEvent): void => {
      const target = choice(event.target);
      if (source.current === 'keyboard' && target !== null) point(target);
    };
    const controller = new AbortController();
    const {signal} = controller;
    element.addEventListener('pointermove', hover, {signal});
    element.addEventListener('pointerout', out, {signal});
    element.addEventListener('pointerleave', leave, {signal});
    document.addEventListener('keydown', keyboard, {signal, capture: true});
    element.addEventListener('focusin', focus, {signal});
    point(
      choice(
        active.current === undefined
          ? document.activeElement
          : document.getElementById(active.current),
      ),
    );
    return () => {
      controller.abort();
      point(null);
    };
  }, [surface]);
}
