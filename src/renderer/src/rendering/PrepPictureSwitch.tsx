import {
  createContext,
  use,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const Switching = createContext<boolean | undefined>(undefined);
let committed: string | null = null;
const listeners = new Set<() => void>();

export function PrepPictureSwitch({
  identity,
  children,
}: {
  readonly identity: string;
  readonly children: ReactNode;
}) {
  const previous = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => committed,
  );
  useLayoutEffect(() => {
    if (committed === identity) return;
    committed = identity;
    for (const listener of listeners) listener();
  }, [identity]);
  return <Switching value={previous !== identity}>{children}</Switching>;
}

export function usePrepPictureSwitch(): boolean | undefined {
  return use(Switching);
}
