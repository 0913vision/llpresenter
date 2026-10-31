import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {handleMenuKey, type MenuCloseReason} from './menuKeys';
import {
  isRunnable,
  hasSubmenu,
  menuItems,
  type MenuEntry,
  type MenuItem,
} from './menuModel';

const SUBMENU_OPEN_DELAY_MS = 150;
const SUBMENU_CLOSE_DELAY_MS = 300;

type TimerName = 'open' | 'close';

function useMenuTimers(): {
  readonly start: (name: TimerName, ms: number, run: () => void) => void;
  readonly stop: (...names: readonly TimerName[]) => void;
} {
  const timers = useRef(new Map<TimerName, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) clearTimeout(timer);
      running.clear();
    };
  }, []);
  const stop = (...names: readonly TimerName[]): void => {
    for (const name of names) {
      clearTimeout(timers.current.get(name));
      timers.current.delete(name);
    }
  };
  const start = (name: TimerName, ms: number, run: () => void): void => {
    stop(name);
    timers.current.set(
      name,
      setTimeout(() => {
        timers.current.delete(name);
        run();
      }, ms),
    );
  };
  return {start, stop};
}

interface OpenSubmenu {
  readonly index: number;
  readonly takesFocus: boolean;
}

/** Pointing, submenu timing, and keyboard actions for one menu surface. */
export interface MenuNavigation {
  readonly items: readonly MenuItem[];
  readonly renaming: boolean;
  readonly pointed: number;
  readonly submenu: OpenSubmenu | null;
  readonly itemElements: RefObject<Array<HTMLDivElement | null>>;
  readonly run: (index: number) => void;
  readonly hover: (index: number) => void;
  readonly leave: () => void;
  readonly closeSubmenu: () => void;
  readonly keepSubmenuOpen: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

function opensSubmenu(item: MenuItem | undefined): boolean {
  return hasSubmenu(item) && isRunnable(item);
}

/** Focuses the menu or its search field unless focus is already inside it. */
export function focusMenu(surface: HTMLElement | null): void {
  if (surface === null || surface.contains(document.activeElement)) return;
  (surface.querySelector('input') ?? surface).focus({preventScroll: true});
}

/** Owns navigation and releases every pending submenu timer on unmount. */
export function useMenuNavigation({
  entries,
  searchValue,
  surface,
  onClose,
  onBack,
  pointsFirst,
}: {
  readonly entries: readonly MenuEntry[];
  readonly searchValue: string | undefined;
  readonly surface: RefObject<HTMLDivElement | null>;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly onBack: (() => void) | undefined;
  /** False for a submenu the pointer opened: nothing is pointed yet. */
  readonly pointsFirst: boolean;
}): MenuNavigation {
  const items = menuItems(entries);
  const renaming = items.some(item => item.rename !== undefined);
  const itemElements = useRef<Array<HTMLDivElement | null>>([]);
  const timers = useMenuTimers();
  const [pointedState, setPointed] = useState(pointsFirst ? 0 : -1);
  const pointing = useRef<'keyboard' | 'pointer'>('keyboard');
  const hovered = useRef<number | null>(null);
  // NOTE(0913vision): In a searched menu, a new search term or a new set of
  // results points to the first item again.
  const results = searchValue === undefined ? '' : items.map(i => i.id).join();
  const [seen, setSeen] = useState({searchValue, results});
  if (seen.searchValue !== searchValue || seen.results !== results) {
    setSeen({searchValue, results});
    setPointed(0);
  }
  const [submenu, setSubmenu] = useState<OpenSubmenu | null>(null);
  if (renaming && submenu !== null) setSubmenu(null);
  const stopTimers = useEffectEvent(() => timers.stop('open', 'close'));
  useEffect(() => {
    if (renaming) stopTimers();
  }, [renaming]);
  const pointed = Math.min(
    pointedState < 0 ? (submenu?.index ?? -1) : pointedState,
    items.length - 1,
  );

  const pointTo = (index: number): void => {
    if (index < 0) return;
    pointing.current = 'keyboard';
    hovered.current = null;
    setPointed(index);
    itemElements.current[index]?.scrollIntoView({block: 'nearest'});
  };
  const openSubmenu = (index: number, takesFocus: boolean): void => {
    timers.stop('open', 'close');
    setSubmenu({index, takesFocus});
  };
  const run = (index: number): void => {
    if (renaming) return;
    const item = items[index];
    if (!isRunnable(item)) return;
    if (hasSubmenu(item)) {
      openSubmenu(index, true);
      return;
    }
    item.onSelect?.();
    if (item.keepsOpen === true) {
      surface.current?.querySelector('input')?.focus({preventScroll: true});
    } else onClose('select');
  };
  const hover = (index: number): void => {
    if (renaming) return;
    if (hovered.current === index && pointing.current === 'pointer') return;
    pointing.current = 'pointer';
    hovered.current = index;
    setPointed(index);
    timers.stop('open');
    const opens = opensSubmenu(items[index]);
    if (submenu === null) {
      if (opens) {
        timers.start('open', SUBMENU_OPEN_DELAY_MS, () =>
          openSubmenu(index, false),
        );
      }
      return;
    }
    if (submenu.index === index) {
      timers.stop('close');
      return;
    }
    // NOTE(0913vision): While a submenu is open, the next one waits for the
    // close delay, so a pointer that crosses other items on its way into the
    // open submenu still gets there.
    timers.start('close', SUBMENU_CLOSE_DELAY_MS, () => {
      setSubmenu(opens ? {index, takesFocus: false} : null);
    });
  };
  const leave = (): void => {
    hovered.current = null;
    timers.stop('open', 'close');
    if (pointing.current === 'pointer') setPointed(-1);
  };
  const closeSubmenu = (): void => {
    timers.stop('open', 'close');
    hovered.current = null;
    pointing.current = 'keyboard';
    setSubmenu(null);
    focusMenu(surface.current);
  };
  const keepSubmenuOpen = (): void => {
    timers.stop('open', 'close');
    if (submenu !== null) setPointed(submenu.index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const closeChild = submenu === null ? undefined : closeSubmenu;
    const actions = {items, pointed, pointTo, run, closeChild, onBack, onClose};
    if (!handleMenuKey(event, actions)) return;
    pointing.current = 'keyboard';
    hovered.current = null;
    event.preventDefault();
    event.stopPropagation();
  };
  return {
    items,
    renaming,
    pointed,
    submenu,
    itemElements,
    run,
    hover,
    leave,
    closeSubmenu,
    keepSubmenuOpen,
    onKeyDown,
  };
}
