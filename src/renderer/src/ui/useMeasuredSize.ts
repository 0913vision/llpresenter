import {useEffectEvent, useLayoutEffect} from 'react';
import {flushSync} from 'react-dom';

/** Read once before paint, then react to each resize in its delivery frame. */
export function useMeasuredSize(
  find: () => HTMLElement | null | undefined,
  measure: (element: HTMLElement, entry?: ResizeObserverEntry) => void,
  key: unknown,
): void {
  const getElement = useEffectEvent(find);
  const accept = useEffectEvent(measure);
  useLayoutEffect(() => {
    const element = getElement();
    if (!element) return;
    accept(element);
    if (typeof ResizeObserver === 'undefined') return;
    let active = true;
    const observer = new ResizeObserver(entries => {
      if (!active) return;
      const entry = entries.filter(each => each.target === element).at(-1);
      if (entry || entries.length === 0) {
        flushSync(() => accept(element, entry));
      }
    });
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [key]);
}
