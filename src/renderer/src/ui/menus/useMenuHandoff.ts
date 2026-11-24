import {useEffect, useRef} from 'react';

/** Mounts the next editor after the menu's passive focus restoration. */
export function useMenuHandoff<T>(open: boolean, accept: (target: T) => void) {
  const pending = useRef<{target: T} | null>(null);
  useEffect(() => {
    if (open || pending.current === null) return;
    const {target} = pending.current;
    pending.current = null;
    accept(target);
  }, [open, accept]);
  return (target: T | null): void => {
    pending.current = target === null ? null : {target};
  };
}
