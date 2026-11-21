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
const keptGrids = new Map<string, number>();
const keptListeners = new Set<() => void>();
let keptVersion = 0;

export function subscribeRetainedGrids(listener: () => void): () => void {
  keptListeners.add(listener);
  return () => keptListeners.delete(listener);
}

export function retainedGridsVersion(): number {
  return keptVersion;
}

export function hasRetainedGrid(serviceId: string, itemId: string): boolean {
  return keptGrids.has(gridKey(serviceId, itemId));
}

function publishKeptGrids(): void {
  keptVersion++;
  for (const listener of keptListeners) listener();
}

function gridKey(serviceId: string, itemId: string): string {
  return JSON.stringify([serviceId, itemId]);
}

/** Records a grid that has committed and remains mounted while hidden. */
export function retainShownGrid(serviceId: string, itemId: string): () => void {
  const key = gridKey(serviceId, itemId);
  keptGrids.set(key, (keptGrids.get(key) ?? 0) + 1);
  publishKeptGrids();
  return () => {
    const count = (keptGrids.get(key) ?? 1) - 1;
    if (count > 0) keptGrids.set(key, count);
    else keptGrids.delete(key);
    publishKeptGrids();
  };
}

/** Whether this service item already has a committed, mounted show grid. */
export function useRetainedShownGrid(
  serviceId: string | null,
  itemId: string | null,
): boolean {
  return useSyncExternalStore(
    listener => {
      keptListeners.add(listener);
      return () => keptListeners.delete(listener);
    },
    () =>
      serviceId !== null &&
      itemId !== null &&
      keptGrids.has(gridKey(serviceId, itemId)),
  );
}

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
  const requested = useShow(view =>
    shownItem === undefined || trackLive ? view.openItemId : null,
  );
  const ready = useShow(view => (trackLive ? view.readyItemId : null));
  const passage = useShow(view => (trackLive ? view.readyPassage : null));
  const liveTitle = useLive(view =>
    trackLive ? view.state?.themeItem?.title : null,
  );
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
  const requested = useShow(view =>
    shown === undefined ? view.openItemId : null,
  );
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
