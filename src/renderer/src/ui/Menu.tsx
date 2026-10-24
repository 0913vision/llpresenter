import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {createPortal} from 'react-dom';
import {classNames} from './classNames';
import {useFloatingPoint} from './floating';
import {layerContainer} from './layers';
import {handleMenuKey, type MenuCloseReason} from './menuKeys';
import {
  hasLeadSlot,
  isRunnable,
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
export type MenuAnchor =
  | {readonly kind: 'element'; readonly element: HTMLElement}
  | {readonly kind: 'point'; readonly point: Point};

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

/** The submenu timers of one menu, released when the menu closes. */
function useMenuTimers(): {
  readonly start: (name: TimerName, ms: number, run: () => void) => void;
  readonly stop: (name: TimerName) => void;
} {
  const timers = useRef(new Map<TimerName, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) clearTimeout(timer);
      running.clear();
    };
  }, []);
  const stop = (name: TimerName): void => {
    const timer = timers.current.get(name);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.current.delete(name);
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
  /** Whether the submenu takes focus, as it does when opened with keys. */
  readonly focus: boolean;
}

interface MenuNavigation {
  readonly items: readonly MenuItem[];
  readonly pointed: number;
  readonly submenu: OpenSubmenu | null;
  readonly itemElements: RefObject<Array<HTMLDivElement | null>>;
  readonly run: (index: number) => void;
  readonly hover: (index: number) => void;
  /** Closes the open submenu and gives focus back to this menu. */
  readonly back: () => void;
  /** Keeps the submenu open while the pointer is inside it. */
  readonly enterSubmenu: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The pointed item and the open submenu of one menu, with the keyboard and
 * pointer rules that move them.
 */
function useMenuNavigation({
  entries,
  surface,
  onClose,
  onBack,
}: {
  readonly entries: readonly MenuEntry[];
  readonly surface: RefObject<HTMLDivElement | null>;
  readonly onClose: (reason: MenuCloseReason) => void;
  readonly onBack: (() => void) | undefined;
}): MenuNavigation {
  const items = menuItems(entries);
  const itemElements = useRef<Array<HTMLDivElement | null>>([]);
  const timers = useMenuTimers();
  const [pointedState, setPointed] = useState(0);
  const [submenu, setSubmenu] = useState<OpenSubmenu | null>(null);
  const pointed = Math.min(pointedState, items.length - 1);

  const pointTo = (index: number): void => {
    setPointed(index);
    itemElements.current[index]?.scrollIntoView({block: 'nearest'});
  };
  const openSubmenu = (index: number, focus: boolean): void => {
    timers.stop('close');
    setSubmenu({index, focus});
  };
  const run = (index: number): void => {
    const item = items[index];
    if (!isRunnable(item)) return;
    if (item.submenu !== undefined) {
      openSubmenu(index, true);
      return;
    }
    item.onSelect?.();
    onClose('select');
  };
  const hover = (index: number): void => {
    setPointed(index);
    timers.stop('open');
    if (submenu !== null && submenu.index !== index) {
      timers.start('close', SUBMENU_CLOSE_DELAY_MS, () => setSubmenu(null));
    }
    if (items[index]?.submenu !== undefined && isRunnable(items[index])) {
      timers.start('open', SUBMENU_OPEN_DELAY_MS, () =>
        openSubmenu(index, false),
      );
    }
  };
  const back = (): void => {
    setSubmenu(null);
    surface.current?.focus();
  };
  const enterSubmenu = (): void => {
    timers.stop('close');
    if (submenu !== null) setPointed(submenu.index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const actions = {items, pointed, pointTo, run, onBack, onClose};
    if (!handleMenuKey(event, actions)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return {
    items,
    pointed,
    submenu,
    itemElements,
    run,
    hover,
    back,
    enterSubmenu,
    onKeyDown,
  };
}

interface SurfaceProps {
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly place: Place;
  readonly onClose: (reason: MenuCloseReason) => void;
  /** Closes only this submenu and gives focus back to its parent. */
  readonly onBack?: (() => void) | undefined;
  readonly onPointerEnter?: (() => void) | undefined;
  readonly search?: MenuSearch | undefined;
  readonly width?: number | undefined;
  readonly minWidth?: number | undefined;
  readonly autoFocus: boolean;
}

function MenuSurface(props: SurfaceProps): JSX.Element {
  const {label, entries, place, onClose, onBack, search, autoFocus} = props;
  const baseId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const nav = useMenuNavigation({entries, surface, onClose, onBack});
  const point = useFloatingPoint(surface, place, nav.items.length);
  const itemId = (index: number): string => `${baseId}-item-${index}`;
  const activeId = nav.pointed >= 0 ? itemId(nav.pointed) : undefined;

  useEffect(() => {
    if (!autoFocus) return;
    const element = surface.current;
    (element?.querySelector('input') ?? element)?.focus();
  }, [autoFocus]);

  const lead = hasLeadSlot(nav.items);
  const renderItem = (item: MenuItem): JSX.Element => {
    const index = nav.items.indexOf(item);
    return (
      <MenuItemRow
        key={item.id}
        item={item}
        id={itemId(index)}
        lead={lead}
        pointed={index === nav.pointed}
        expanded={nav.submenu?.index === index}
        elementRef={element => {
          nav.itemElements.current[index] = element;
        }}
        onPoint={() => nav.hover(index)}
        onRun={() => nav.run(index)}
      />
    );
  };
  const style: CSSProperties = {
    left: point?.x ?? 0,
    top: point?.y ?? 0,
    width: props.width,
    minWidth: props.minWidth,
    maxHeight: maxPopoverHeight(viewportSize()),
  };

  return (
    <>
      <div
        ref={surface}
        id={baseId}
        role="menu"
        aria-label={label}
        aria-activedescendant={search === undefined ? activeId : undefined}
        tabIndex={-1}
        className={classNames(styles.menu, point === null && styles.measuring)}
        style={style}
        onKeyDown={nav.onKeyDown}
        onPointerEnter={props.onPointerEnter}
      >
        {search === undefined ? null : (
          <MenuSearchField
            search={search}
            menuId={baseId}
            activeId={activeId}
          />
        )}
        <MenuBlocks entries={entries} baseId={baseId} renderItem={renderItem} />
      </div>
      <Submenu nav={nav} parent={surface} onClose={onClose} />
    </>
  );
}

/** The open submenu of a menu, beside its parent item. */
function Submenu({
  nav,
  parent,
  onClose,
}: {
  readonly nav: MenuNavigation;
  readonly parent: RefObject<HTMLDivElement | null>;
  readonly onClose: (reason: MenuCloseReason) => void;
}): JSX.Element | null {
  const {submenu} = nav;
  if (submenu === null) return null;
  const item = nav.items[submenu.index];
  const element = nav.itemElements.current[submenu.index];
  if (
    item?.submenu === undefined ||
    element === null ||
    element === undefined
  ) {
    return null;
  }
  const place = (size: Size): Point => {
    const itemBox = element.getBoundingClientRect();
    const menuBox = parent.current?.getBoundingClientRect() ?? itemBox;
    return placeSubmenu(itemBox, menuBox, size, viewportSize());
  };
  return (
    <MenuSurface
      label={item.label}
      entries={item.submenu}
      place={place}
      onClose={onClose}
      onBack={nav.back}
      onPointerEnter={nav.enterSubmenu}
      autoFocus={submenu.focus}
    />
  );
}

/**
 * A floating menu below a button or at the pointer. It takes focus, points to
 * the first item, and gives focus back to where it was opened when it closes.
 * A click outside closes it and doesn't reach what is underneath.
 */
export function Menu({
  label,
  entries,
  anchor,
  onClose,
  search,
  width,
  minWidth,
}: MenuProps): JSX.Element {
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const [place] = useState(() => anchorPlace(anchor));

  useEffect(
    () => () => {
      if (opener?.isConnected === true) opener.focus();
    },
    [opener],
  );

  return createPortal(
    <>
      <div
        className={styles.catcher}
        onPointerDown={event => {
          event.preventDefault();
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
        autoFocus
      />
    </>,
    layerContainer('popover'),
  );
}
