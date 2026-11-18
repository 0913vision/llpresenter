import {
  createContext,
  use,
  useDeferredValue,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {useShow} from './showStore';
import {useLive} from './live';

const ShownItem = createContext<string | null | undefined>(undefined);

/**
 * Gives a workspace the open item as its screen shows it. A newly opened item
 * shows once everything it shows is ready; until then the workspace keeps
 * showing the previous item, its list selection included, unchanged.
 */
export function ShownItemProvider({
  children,
  shownItem,
  trackLive = shownItem === undefined,
}: {
  readonly children: ReactNode;
  readonly shownItem?: string | null | undefined;
  readonly trackLive?: boolean;
}): JSX.Element {
  const requested = useShow(view => view.openItemId);
  const ready = useShow(view => view.readyItemId);
  const passage = useShow(view => view.readyPassage);
  const liveTitle = useLive(view => view.state?.themeItem?.title);
  const shown = useDeferredValue(shownItem === undefined ? requested : null);
  const fallback = shownItem === undefined ? shown : shownItem;
  if (!trackLive) {
    return <ShownItem value={fallback}>{children}</ShownItem>;
  }
  if (passage?.id === requested && passage.title !== liveTitle) {
    return <ShownItem value={passage.previous}>{children}</ShownItem>;
  }
  return (
    <ShownItem value={ready === requested ? requested : fallback}>
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
