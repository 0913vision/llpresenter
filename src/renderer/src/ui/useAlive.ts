import {useLayoutEffect, useRef, type RefObject} from 'react';

/**
 * True while the component is on screen: an answer that arrives after it
 * closed is dropped instead of setting state on a component that is gone.
 */
export function useAlive(): RefObject<boolean> {
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
