import {useEffect, useLayoutEffect, useRef, type RefObject} from 'react';

/**
 * Keeps the keyboard in the continuous 슬라이드 grid when the band that held
 * the focus scrolls out of its window: the band unmounts with its listbox, and
 * the focus would drop onto the page (after 다음 항목, or when LIVE moves on).
 * It moves to a band still drawn. A click or a Tab elsewhere lets the grid go,
 * and a hidden (inert) frame never takes the focus.
 */
export function useGridKeepsFocus(grid: RefObject<HTMLElement | null>): void {
  const holds = useRef(false);
  useEffect(() => {
    const element = grid.current;
    if (element === null) return;
    const onFocusIn = (): void => {
      holds.current = true;
    };
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget;
      if (next instanceof Node && !element.contains(next)) {
        holds.current = false;
      }
    };
    // NOTE(0913vision): A click on something that takes no focus leaves the
    // focus on the page with no next element; the click still means the
    // operator turned to it.
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || !element.contains(event.target)) {
        holds.current = false;
      }
    };
    const page = element.ownerDocument;
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    page.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      page.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [grid]);
  useLayoutEffect(() => {
    const element = grid.current;
    if (
      !holds.current ||
      element === null ||
      element.ownerDocument.activeElement !== element.ownerDocument.body ||
      element.closest('[inert]') !== null
    ) {
      return;
    }
    element
      .querySelector<HTMLElement>('[role="listbox"]')
      ?.focus({preventScroll: true});
  });
}
