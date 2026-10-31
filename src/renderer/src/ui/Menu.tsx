import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import {createPortal} from 'react-dom';
import {placeFloating} from './floating';
import {layerContainer} from './layers';
import {lastInputWasKeyboard} from './inputModality';
import {handleMenuKey, openItemMenu, type MenuCloseReason} from './menuKeys';
import {modalStack} from './modalStack';
import {markMenuTarget} from './contextMenu';
import {
  isRunnable,
  hasSubmenu,
  hasCheckColumn,
  menuItems,
  type MenuEntry,
  type MenuItem,
} from './menuModel';
import {
  MenuBlocks,
  MenuItemRow,
  MenuSearchField,
  type MenuSearch,
} from './MenuParts';
import {
  maxPopoverHeight,
  menuChainShift,
  placeAtPoint,
  placeBelow,
  placeSubmenu,
  viewportSize,
  type Point,
  type Size,
} from './placement';
import styles from './Menu.module.css';

export type {MenuCloseReason} from './menuKeys';
export type {MenuSearch} from './MenuParts';

/** Where a menu opens: below a button, or at the pointer (right-click). */
export type MenuAnchor = (
  | {readonly kind: 'element'; readonly element: HTMLElement}
  | {readonly kind: 'point'; readonly point: Point}
) & {readonly target?: HTMLElement | undefined};

export interface MenuProps {
  /** The menu name for assistive technology. */
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly search?: MenuSearch | undefined;
  /** A fixed width, such as 300 for the service picker. */
  readonly width?: number | undefined;
  /** The narrowest the menu may be, such as the width of a Select. */
  readonly minWidth?: number | undefined;
  readonly footer?: ReactNode | undefined;
}

const SUBMENU_OPEN_DELAY_MS = 150;
const SUBMENU_CLOSE_DELAY_MS = 300;

type Place = (size: Size) => Point;
type TimerName = 'open' | 'close';

function anchorPlace(anchor: MenuAnchor): Place {
  switch (anchor.kind) {
    case 'element':
      return size =>
        placeBelow(
          anchor.element.getBoundingClientRect(),
          size,
          viewportSize(),
        );
    case 'point':
      return size => placeAtPoint(anchor.point, size, viewportSize());
  }
}

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

interface MenuNavigation {
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

function focusMenu(surface: HTMLElement | null): void {
  if (surface === null || surface.contains(document.activeElement)) return;
  (surface.querySelector('input') ?? surface).focus({preventScroll: true});
}

function useMenuNavigation({
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

interface SurfaceProps {
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly place: Place;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly onBack?: (() => void) | undefined;
  readonly onPointerEnter?: (() => void) | undefined;
  readonly search?: MenuSearch | undefined;
  readonly width?: number | undefined;
  readonly minWidth?: number | undefined;
  readonly autoFocus: boolean;
  readonly footer?: ReactNode | undefined;
  readonly ancestors?: ReadonlyArray<RefObject<HTMLDivElement | null>>;
}

function MenuSurface(props: SurfaceProps): JSX.Element {
  const {label, entries, place, onClose, onBack, search, autoFocus} = props;
  const baseId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const blockedPointer = useRef(false);
  const [openedByKeyboard] = useState(lastInputWasKeyboard);
  const nav = useMenuNavigation({
    entries,
    searchValue: search?.value,
    surface,
    onClose,
    onBack,
    pointsFirst: autoFocus && (openedByKeyboard || search !== undefined),
  });
  const itemId = (index: number): string => `${baseId}-item-${index}`;
  const activeId = nav.pointed >= 0 ? itemId(nav.pointed) : undefined;

  useEffect(() => {
    if (autoFocus) focusMenu(surface.current);
  }, [autoFocus]);

  const fit = (element: HTMLElement): void => {
    element.style.maxHeight = `${maxPopoverHeight(viewportSize())}px`;
    placeFloating(element, place);
    if (!props.ancestors?.length) return;
    const chain = [
      ...(props.ancestors ?? []).flatMap(ref =>
        ref.current ? [ref.current] : [],
      ),
      element,
    ];
    const boxes = chain.map(menu => menu.getBoundingClientRect());
    const shift = menuChainShift(boxes, viewportSize());
    if (shift !== 0) {
      chain.forEach((menu, index) => {
        const box = boxes[index];
        if (box) {
          menu.style.left = `${box.left + shift}px`;
        }
      });
    }
  };
  const refit = useEffectEvent(() => {
    if (surface.current !== null) fit(surface.current);
  });
  useEffect(() => {
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);

  const renderItem = (item: MenuItem, iconColumn: boolean): JSX.Element => {
    const index = nav.items.indexOf(item);
    return (
      <MenuItemRow
        key={item.id}
        item={
          nav.renaming && item.rename === undefined
            ? {...item, disabled: true, title: '이름 편집 중'}
            : item
        }
        id={itemId(index)}
        iconColumn={iconColumn}
        pointed={!nav.renaming && index === nav.pointed}
        expanded={nav.submenu?.index === index}
        elementRef={element => {
          nav.itemElements.current[index] = element;
        }}
        onPoint={() => nav.hover(index)}
        onLeave={nav.leave}
        onRun={() => nav.run(index)}
      />
    );
  };
  const style: CSSProperties = {width: props.width, minWidth: props.minWidth};
  const isRenameTarget = (target: EventTarget): boolean =>
    target instanceof Element && target.closest('[data-renaming]') !== null;
  const commitRename = (): void => {
    const field = surface.current?.querySelector<HTMLElement>(
      '[data-renaming] input',
    );
    field?.blur();
    field?.focus();
  };
  const consumeClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (
      !blockedPointer.current &&
      (!nav.renaming || isRenameTarget(event.target))
    ) {
      return;
    }
    blockedPointer.current = false;
    event.preventDefault();
    event.stopPropagation();
    if (nav.renaming) commitRename();
  };

  return (
    <>
      <div
        ref={element => {
          surface.current = element;
          if (element !== null) fit(element);
        }}
        id={baseId}
        role="menu"
        aria-label={label}
        aria-activedescendant={search === undefined ? activeId : undefined}
        tabIndex={-1}
        className={styles.menu}
        data-check-column={hasCheckColumn(entries) ? 'true' : 'false'}
        style={style}
        onPointerDownCapture={event => {
          blockedPointer.current = false;
          if (!nav.renaming || isRenameTarget(event.target)) return;
          blockedPointer.current = true;
          event.preventDefault();
          event.stopPropagation();
          commitRename();
        }}
        onClickCapture={consumeClick}
        onContextMenuCapture={consumeClick}
        onKeyDown={event => {
          if (nav.renaming) return;
          if (
            openItemMenu(
              event,
              nav.items[nav.pointed],
              nav.itemElements.current[nav.pointed],
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          } else {
            nav.onKeyDown(event);
          }
        }}
        onPointerEnter={() => {
          focusMenu(surface.current);
          props.onPointerEnter?.();
        }}
        onPointerLeave={nav.leave}
        onPointerMove={event => {
          if (
            event.target instanceof Element &&
            !event.target.closest('[role^="menuitem"]')
          ) {
            nav.leave();
          }
        }}
      >
        {search === undefined ? null : (
          <MenuSearchField
            search={search}
            menuId={baseId}
            activeId={activeId}
            pointedId={nav.items[nav.pointed]?.id}
          />
        )}
        <MenuBlocks entries={entries} baseId={baseId} renderItem={renderItem} />
        {props.footer}
      </div>
      <Submenu
        nav={nav}
        parent={surface}
        ancestors={props.ancestors ?? []}
        onClose={onClose}
      />
    </>
  );
}

function Submenu({
  nav,
  parent,
  ancestors,
  onClose,
}: {
  readonly nav: MenuNavigation;
  readonly parent: RefObject<HTMLDivElement | null>;
  readonly ancestors: ReadonlyArray<RefObject<HTMLDivElement | null>>;
  readonly onClose: (reason: MenuCloseReason) => void;
}): JSX.Element | null {
  const {submenu} = nav;
  const item = submenu === null ? undefined : nav.items[submenu.index];
  const entries = useMemo(
    () =>
      isRunnable(item) ? (item.submenu ?? item.loadSubmenu?.()) : undefined,
    [item],
  );
  if (submenu === null) return null;
  const element = nav.itemElements.current[submenu.index];
  if (
    item === undefined ||
    entries === undefined ||
    element === null ||
    element === undefined
  ) {
    return null;
  }
  const place = (size: Size): Point => {
    const itemBox = element.getBoundingClientRect();
    const menuBox = parent.current?.getBoundingClientRect() ?? itemBox;
    const boxes = ancestors.flatMap(ref =>
      ref.current ? [ref.current.getBoundingClientRect()] : [],
    );
    return placeSubmenu(
      {item: itemBox, menu: menuBox, ancestors: boxes},
      size,
      viewportSize(),
    );
  };
  return (
    <MenuSurface
      label={item.label}
      entries={entries}
      place={place}
      onClose={onClose}
      onBack={nav.closeSubmenu}
      onPointerEnter={nav.keepSubmenuOpen}
      autoFocus={submenu.takesFocus}
      ancestors={[...ancestors, parent]}
    />
  );
}

/**
 * A floating menu below a button or at the pointer. It takes focus, points to
 * the first item, and gives focus back to where it was opened when it closes.
 * A click outside closes it and doesn't reach what is underneath. A menu
 * anchored in a menubar leaves the heading strip interactive.
 */
export function Menu({
  label,
  entries,
  anchor,
  onClose,
  search,
  width,
  minWidth,
  footer,
}: MenuProps): JSX.Element {
  const catcher = useRef<HTMLDivElement>(null);
  const outsideRename = useRef(false);
  const renaming = menuItems(entries).some(item => item.rename !== undefined);
  useEffect(() => {
    if (!outsideRename.current || renaming) return;
    outsideRename.current = false;
    onClose('outside');
  }, [renaming, onClose]);
  useLayoutEffect(
    () => (anchor.target ? markMenuTarget(anchor.target) : undefined),
    [anchor.target],
  );
  const [menubar] = useState(() =>
    anchor.kind === 'element'
      ? anchor.element.closest('[role="menubar"]')
      : null,
  );
  useLayoutEffect(() => {
    const element = catcher.current;
    if (menubar === null || element === null) return undefined;
    const fit = (): void => {
      element.style.top = `${menubar.getBoundingClientRect().bottom}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [menubar]);
  const [opener] = useState(() => {
    if (menubar !== null && anchor.kind === 'element') return anchor.element;
    return document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  });
  const [place] = useState(() => anchorPlace(anchor));
  const [overModal] = useState(() => modalStack.isOpen);

  useEffect(
    () => () => {
      if (opener?.isConnected === true) opener.focus();
    },
    [opener],
  );

  return createPortal(
    <div className={styles.layer} data-over-modal={overModal ? '' : undefined}>
      <div
        ref={catcher}
        className={styles.catcher}
        onPointerDown={event => {
          event.preventDefault();
          if (renaming) {
            const field =
              event.currentTarget.parentElement?.querySelector<HTMLElement>(
                '[data-renaming] input',
              );
            field?.blur();
            field?.focus();
            outsideRename.current = true;
            return;
          }
          onClose('outside');
        }}
        onContextMenu={event => event.preventDefault()}
      />
      <MenuSurface
        label={label}
        entries={entries}
        place={place}
        onClose={onClose}
        search={search}
        width={width}
        minWidth={minWidth}
        footer={footer}
        autoFocus
      />
    </div>,
    layerContainer('popover'),
  );
}
