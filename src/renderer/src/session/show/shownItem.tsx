import {
  createContext,
  use,
  useDeferredValue,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {useShow} from './showStore';

const ShownItem = createContext<string | null | undefined>(undefined);

/**
 * Gives a workspace the open item as its screen shows it: its list, its slides
 * and its panels change to another item in one commit.
 */
export function ShownItemProvider({
  children,
  shownItem,
}: {
  readonly children: ReactNode;
  readonly shownItem?: string | null | undefined;
}): JSX.Element {
  const requested = useShow(view => view.openItemId);
  const shown = useDeferredValue(shownItem === undefined ? requested : null);
  return (
    <ShownItem value={shownItem === undefined ? shown : shownItem}>
      {children}
    </ShownItem>
  );
}

/** The open item as the screen shows it, or as opened outside a provider. */
export function useShownItemId(): string | null {
  const shown = use(ShownItem);
  const requested = useShow(view => view.openItemId);
  return shown === undefined ? requested : shown;
}

let committed: string | null = null;
const listeners = new Set<() => void>();

/** The item the 진행 grid showed after the last commit. */
export function getCommittedShownItem(): string | null {
  return committed;
}

/** Notes the item the 진행 grid shows on screen after a commit. */
export function commitShownItem(itemId: string | null): void {
  if (committed === itemId) return;
  committed = itemId;
  for (const listener of listeners) listener();
}

/** The item the 진행 grid showed in its last commit. */
export function useCommittedShownItem(): string | null {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getCommittedShownItem);
}
