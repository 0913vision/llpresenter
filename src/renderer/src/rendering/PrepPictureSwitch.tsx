import {
  createContext,
  use,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const Switching = createContext<boolean | undefined>(undefined);
/** Whether a kept preparation frame is visible and has already committed. */
export const PrepFrameStatus = createContext({active: true, retained: false});
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
  const frame = use(PrepFrameStatus);
  useLayoutEffect(() => {
    if (!frame.active) return;
    if (committed === identity) return;
    committed = identity;
    for (const listener of listeners) listener();
  }, [frame.active, identity]);
  return (
    <Switching value={frame.active && !frame.retained && previous !== identity}>
      {children}
    </Switching>
  );
}

export function usePrepPictureSwitch(): boolean | undefined {
  return use(Switching);
}
