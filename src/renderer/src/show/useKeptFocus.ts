import {
  useCallback,
  useEffect,
  useRef,
  type FocusEvent,
  type RefObject,
} from 'react';

/**
 * Remembers whether the keyboard focus is inside an element, so the element
 * can take it back when the focused child is replaced. The browser drops the
 * focus to the body in that case, and then nothing else says where it was.
 *
 * @returns `isInside` reads the memory, and `onFocus` and `onBlur` go on the
 *   element.
 */
export function useKeptFocus(ref: RefObject<HTMLElement | null>): {
  readonly isInside: () => boolean;
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
} {
  const inside = useRef(false);

  useEffect(() => {
    const forgetOnPressOutside = (event: PointerEvent): void => {
      const {target} = event;
      if (target instanceof Node && ref.current?.contains(target)) return;
      inside.current = false;
    };
    document.addEventListener('pointerdown', forgetOnPressOutside, true);
    return () =>
      document.removeEventListener('pointerdown', forgetOnPressOutside, true);
  }, [ref]);

  const isInside = useCallback(() => inside.current, []);
  const onFocus = useCallback(() => {
    inside.current = true;
  }, []);
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const {relatedTarget} = event;
    if (
      relatedTarget instanceof Node &&
      !event.currentTarget.contains(relatedTarget)
    ) {
      inside.current = false;
    }
  }, []);

  return {isInside, onFocus, onBlur};
}
