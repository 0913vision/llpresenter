import {useEffect, useRef} from 'react';

const MENU_SURFACE = '[role="menubar"], [role="menu"], [data-llp-layer]';

/**
 * Remembers the element that last had keyboard focus outside the menu bar and
 * its menus. A menu takes focus when it opens, so the 편집 rows ask this
 * element what they would act on.
 *
 * @returns A function that reads it, or `null` when it has left the page.
 */
export function useOutsideFocus(): () => Element | null {
  const last = useRef<Element | null>(null);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest(MENU_SURFACE) === null
      ) {
        last.current = event.target;
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  return () => (last.current?.isConnected === true ? last.current : null);
}
