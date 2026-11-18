import {
  createContext,
  use,
  useDeferredValue,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {useShow} from './show';

const ShownItem = createContext<string | null | undefined>(undefined);

/**
 * Gives a workspace the open item as its screen shows it. A newly opened item
 * shows once everything it shows is ready; until then the workspace keeps
 * showing the previous item, its list selection included, unchanged.
 */
export function ShownItemProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const requested = useShow(view => view.openItemId);
  const shown = useDeferredValue(requested);
  return <ShownItem value={shown}>{children}</ShownItem>;
}

/** The open item as the screen shows it, or as opened outside a provider. */
export function useShownItemId(): string | null {
  const shown = use(ShownItem);
  const requested = useShow(view => view.openItemId);
  return shown === undefined ? requested : shown;
}

let committed: string | null = null;
const listeners = new Set<() => void>();

/** Notes the item the 진행 grid shows on screen after a commit. */
export function commitShownItem(itemId: string | null): void {
  if (committed === itemId) return;
  committed = itemId;
  for (const listener of listeners) listener();
}

/** The item the 진행 grid showed in its last commit. */
export function useCommittedShownItem(): string | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => committed,
  );
}
