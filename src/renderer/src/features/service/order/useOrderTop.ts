import {useLayoutEffect, useRef, type RefObject} from 'react';
import {scrollParent} from '@renderer/ui/scrollParent';

/** Goes to the top of the list when another service opens. */
export function useOrderTop(
  list: RefObject<HTMLDivElement | null>,
  serviceId: string | null,
): void {
  const shown = useRef(serviceId);
  useLayoutEffect(() => {
    if (shown.current === serviceId) return;
    shown.current = serviceId;
    const viewport = scrollParent(list.current);
    if (viewport !== null) viewport.scrollTop = 0;
  }, [list, serviceId]);
}
