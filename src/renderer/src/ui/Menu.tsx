import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {createPortal} from 'react-dom';
import {classNames} from './classNames';
import {useFloatingPoint} from './floating';
import {Icon} from './Icon';
import {layerContainer} from './layers';
import {
  hasLeadSlot,
  isRunnable,
  menuBlocks,
  menuItemRole,
  menuItems,
  movePointer,
  typeaheadTarget,
  type MenuEntry,
  type MenuItem,
  type MenuMove,
} from './menuModel';
import {
  maxPopoverHeight,
  placeAtPoint,
  placeBelow,
  placeSubmenu,
  viewportSize,
  type Point,
  type Size,
} from './placement';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './Menu.module.css';

/** Where a menu opens: below a button, or at the pointer (right-click). */
export type MenuAnchor =
  | {readonly kind: 'element'; readonly element: HTMLElement}
  | {readonly kind: 'point'; readonly point: Point};

/** Why a menu closed: an item ran, Esc, a click outside, or Tab. */
export type MenuCloseReason = 'select' | 'escape' | 'outside' | 'tab';

/** A search field at the top of the menu; the caller filters the entries. */
export interface MenuSearch {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string | undefined;
}

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
const ICON_SIZE = 14;
const CHEVRON_SIZE = 12;
const SEARCH_ICON_SIZE = 16;
const SEARCH_PLACEHOLDER = '검색';

const keyMoves: Readonly<Record<string, MenuMove>> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
};

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

function isPrintable(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  );
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

interface MenuKeyActions {
  readonly items: readonly MenuItem[];
  readonly pointed: number;
  readonly pointTo: (index: number) => void;
  readonly run: (index: number) => void;
  readonly onBack: (() => void) | undefined;
  readonly onClose: (reason: MenuCloseReason) => void;
}

/**
 * Handles one key in a menu and reports whether the menu used it. In the
 * search field, keys that edit text stay with the field.
 */
function handleMenuKey(event: KeyboardEvent, actions: MenuKeyActions): boolean {
  const {items, pointed, pointTo, run, onBack, onClose} = actions;
  const inField = event.target instanceof HTMLInputElement;
  const move = keyMoves[event.key];
  if (
    move !== undefined &&
    !(inField && (move === 'first' || move === 'last'))
  ) {
    pointTo(movePointer(items.length, pointed, move));
    return true;
  }
  switch (event.key) {
    case 'Enter':
      run(pointed);
      return true;
    case ' ':
      if (inField) return false;
      run(pointed);
      return true;
    case 'ArrowRight':
      if (inField || items[pointed]?.submenu === undefined) return false;
      run(pointed);
      return true;
    case 'ArrowLeft':
      if (inField || onBack === undefined) return false;
      onBack();
      return true;
    case 'Escape':
      if (onBack === undefined) onClose('escape');
      else onBack();
      return true;
    case 'Tab':
      onClose('tab');
      return true;
    default: {
      if (inField || !isPrintable(event)) return false;
      const target = typeaheadTarget(items, pointed, event.key);
      if (target >= 0) pointTo(target);
      return true;
    }
  }
}

function ItemLead({item}: {readonly item: MenuItem}): JSX.Element {
  return (
    <span className={styles.lead}>
      {item.checked === true ? (
        <Icon name="check" size={ICON_SIZE} className={styles.mark} />
      ) : item.icon === undefined ? null : (
        <Icon name={item.icon} size={ICON_SIZE} />
      )}
    </span>
  );
}

interface ItemRowProps {
  readonly item: MenuItem;
  readonly id: string;
  readonly lead: boolean;
  readonly pointed: boolean;
  readonly expanded: boolean;
  readonly elementRef: (element: HTMLDivElement | null) => void;
  readonly onPoint: () => void;
  readonly onRun: () => void;
}

function ItemRow({
  item,
  id,
  lead,
  pointed,
  expanded,
  elementRef,
  onPoint,
  onRun,
}: ItemRowProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(item.title));
  const hasSubmenu = item.submenu !== undefined;
  return (
    <div
      {...targetProps}
      ref={elementRef}
      id={id}
      role={menuItemRole(item)}
      aria-checked={
        item.check === undefined ? undefined : item.checked === true
      }
      aria-disabled={item.disabled === true ? true : undefined}
      aria-haspopup={hasSubmenu ? 'menu' : undefined}
      aria-expanded={hasSubmenu ? expanded : undefined}
      data-pointed={pointed}
      className={styles.item}
      onPointerEnter={event => {
        targetProps.onPointerEnter(event);
        onPoint();
      }}
      onClick={onRun}
    >
      {lead ? <ItemLead item={item} /> : null}
      {item.swatch === undefined ? null : (
        <span
          className={styles.swatch}
          data-color={item.swatch}
          style={{backgroundColor: `var(--label-${item.swatch})`}}
        />
      )}
      <span className={styles.label}>{item.label}</span>
      {item.meta === undefined ? null : (
        <span className={styles.meta}>{item.meta}</span>
      )}
      {hasSubmenu ? (
        <Icon name="right" size={CHEVRON_SIZE} className={styles.chevron} />
      ) : null}
      {tooltip}
    </div>
  );
}

function SearchField({
  search,
  menuId,
  activeId,
}: {
  readonly search: MenuSearch;
  readonly menuId: string;
  readonly activeId: string | undefined;
}): JSX.Element {
  const placeholder = search.placeholder ?? SEARCH_PLACEHOLDER;
  return (
    <label className={styles.search}>
      <Icon name="search" size={SEARCH_ICON_SIZE} />
      <input
        className={styles.searchInput}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={menuId}
        aria-activedescendant={activeId}
        aria-label={placeholder}
        placeholder={placeholder}
        value={search.value}
        onChange={event => search.onChange(event.target.value)}
      />
    </label>
  );
}

function MenuBlocks({
  entries,
  baseId,
  renderItem,
}: {
  readonly entries: readonly MenuEntry[];
  readonly baseId: string;
  readonly renderItem: (item: MenuItem) => JSX.Element;
}): JSX.Element {
  return (
    <div className={styles.scroll}>
      {menuBlocks(entries).map(block => {
        switch (block.kind) {
          case 'separator':
            return (
              <div
                key={block.id}
                role="separator"
                className={styles.separator}
              />
            );
          case 'group': {
            const labelId = `${baseId}-${block.id}`;
            return (
              <div key={block.id} role="group" aria-labelledby={labelId}>
                <div id={labelId} className={styles.group}>
                  {block.label}
                </div>
                {block.items.map(renderItem)}
              </div>
            );
          }
          case 'items':
            return block.items.map(renderItem);
        }
      })}
    </div>
  );
}

interface OpenSubmenu {
  readonly index: number;
  /** Whether the submenu takes focus, as it does when opened with keys. */
  readonly focus: boolean;
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
  const itemElements = useRef<Array<HTMLDivElement | null>>([]);
  const timers = useMenuTimers();
  const items = menuItems(entries);
  const [pointedState, setPointed] = useState(0);
  const [submenu, setSubmenu] = useState<OpenSubmenu | null>(null);
  const point = useFloatingPoint(surface, place, items.length);
  const pointed = Math.min(pointedState, items.length - 1);
  const itemId = (index: number): string => `${baseId}-item-${index}`;

  useEffect(() => {
    if (!autoFocus) return;
    const element = surface.current;
    (element?.querySelector('input') ?? element)?.focus();
  }, [autoFocus]);

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
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const actions = {items, pointed, pointTo, run, onBack, onClose};
    if (!handleMenuKey(event, actions)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const lead = hasLeadSlot(items);
  const renderItem = (item: MenuItem): JSX.Element => {
    const index = items.indexOf(item);
    return (
      <ItemRow
        key={item.id}
        item={item}
        id={itemId(index)}
        lead={lead}
        pointed={index === pointed}
        expanded={submenu?.index === index}
        elementRef={element => {
          itemElements.current[index] = element;
        }}
        onPoint={() => hover(index)}
        onRun={() => run(index)}
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
  const activeId = pointed >= 0 ? itemId(pointed) : undefined;
  const openItem = submenu === null ? undefined : items[submenu.index];
  const openElement =
    submenu === null ? null : itemElements.current[submenu.index];

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
        onKeyDown={onKeyDown}
        onPointerEnter={props.onPointerEnter}
      >
        {search === undefined ? null : (
          <SearchField search={search} menuId={baseId} activeId={activeId} />
        )}
        <MenuBlocks entries={entries} baseId={baseId} renderItem={renderItem} />
      </div>
      {submenu === null ||
      openItem?.submenu === undefined ||
      openElement === null ||
      openElement === undefined ? null : (
        <MenuSurface
          label={openItem.label}
          entries={openItem.submenu}
          place={size =>
            placeSubmenu(
              openElement.getBoundingClientRect(),
              surface.current?.getBoundingClientRect() ??
                openElement.getBoundingClientRect(),
              size,
              viewportSize(),
            )
          }
          onClose={onClose}
          onBack={back}
          onPointerEnter={() => {
            timers.stop('close');
            setPointed(submenu.index);
          }}
          autoFocus={submenu.focus}
        />
      )}
    </>
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
