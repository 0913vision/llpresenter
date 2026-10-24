import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {clickFocusProps} from './clickFocus';
import type {MenuAnchor} from './Menu';

const TILE = '[role="option"]';
const SPACE = ' ';
const MENU_KEY = 'ContextMenu';
const SHIFT_MENU_KEY = 'F10';

/** How each arrow key moves the selection, given the column count. */
export type TileMoves = Readonly<Record<string, (columns: number) => number>>;

/** ↑ and ↓ only, one row at a time: the 장 grid of 진행. */
export const rowMoves: TileMoves = {
  ArrowUp: columns => -columns,
  ArrowDown: columns => columns,
};

/** Every arrow key: a grid of tiles. */
export const gridMoves: TileMoves = {
  ...rowMoves,
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
};

/** ← and → only: one row of tiles, such as the media strip. */
export const stripMoves: TileMoves = {
  ArrowLeft: () => -1,
  ArrowRight: () => 1,
};

/**
 * What Space does on a focused tile: press it like Enter, or pass on to the
 * window, where 진행 uses it for 다음 장.
 */
export type TileSpaceKey = 'press' | 'pass';

/** The column count that ↑ and ↓ move by, or `auto` to read it from the layout. */
export type TileColumns = number | 'auto';

/** The props that every tile list takes. */
export interface TileListBaseProps {
  /** The list name for assistive technology, such as 장 or 매크로. */
  readonly label: string;
  readonly moves: TileMoves;
  readonly columns: TileColumns;
  readonly spaceKey: TileSpaceKey;
  /**
   * Takes keyboard focus on a mouse click also in 진행, as the 장 grid does.
   * Other tile lists leave focus where it was there
   * (docs/spec/10-shortcuts-and-settings.md).
   */
  readonly takesClickFocus?: boolean | undefined;
  /** The index of the selected tile. */
  readonly selected: number | undefined;
  /** A click or Enter (and Space with `press`) on a tile that isn't disabled. */
  readonly onActivate: (index: number) => void;
  readonly onDoubleClick?: ((index: number) => void) | undefined;
  /** A right-click, Shift F10, or the Menu key on a tile. */
  readonly onMenu?: ((index: number, anchor: MenuAnchor) => void) | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  /** The tiles (`role="option"`), in order; an index counts only these. */
  readonly children: ReactNode;
}

/**
 * The arrow keys move the selection, and the selected tile (else the first)
 * takes the Tab stop. While focus is in the list, it follows the selection,
 * also when another command moves it.
 */
export interface SelectionArrowsProps extends TileListBaseProps {
  readonly arrowsMove: 'selection';
  /** An arrow key moved the selection. */
  readonly onSelect: (index: number) => void;
}

/**
 * The arrow keys move only keyboard focus, and the tile last in focus takes
 * the Tab stop. The selection stays for what the caller uses it for, such as
 * the tile under a right-click menu.
 */
export interface FocusArrowsProps extends TileListBaseProps {
  readonly arrowsMove: 'focus';
}

export type TileListProps = SelectionArrowsProps | FocusArrowsProps;

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function isMenuKey(event: KeyboardEvent): boolean {
  if (event.key === MENU_KEY) return true;
  return event.key === SHIFT_MENU_KEY && event.shiftKey;
}

function tilesOf(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(TILE)];
}

function tileOf(target: EventTarget): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(TILE) : null;
}

function indexOf(list: HTMLElement, tile: HTMLElement | null): number {
  return tile === null ? -1 : tilesOf(list).indexOf(tile);
}

function isDisabled(tile: HTMLElement): boolean {
  return tile.getAttribute('aria-disabled') === 'true';
}

function columnCount(list: HTMLElement, columns: TileColumns): number {
  if (columns !== 'auto') return columns;
  const tiles = tilesOf(list);
  const firstRowTop = tiles[0]?.offsetTop;
  const nextRow = tiles.findIndex(tile => tile.offsetTop !== firstRowTop);
  return nextRow < 0 ? Math.max(tiles.length, 1) : nextRow;
}

function keepOneTabStop(list: HTMLElement, stop: number): void {
  const tiles = tilesOf(list);
  const index = Math.min(stop, tiles.length - 1);
  for (const [position, tile] of tiles.entries()) {
    tile.tabIndex = position === index ? 0 : -1;
  }
}

function useFocusFollowsSelection(
  listRef: RefObject<HTMLDivElement | null>,
  selected: number | undefined,
): void {
  useEffect(() => {
    const list = listRef.current;
    if (selected === undefined || !list?.contains(document.activeElement)) {
      return;
    }
    const tile = tilesOf(list)[selected];
    if (tile !== document.activeElement) tile?.focus();
  }, [listRef, selected]);
}

/**
 * A listbox of tiles that Tab enters once: the 장 grid, the media grid and
 * strip, and the macro grid build on it. It owns the Tab stop of its tiles,
 * so the tiles set no `tabIndex`. Keys with Ctrl, Alt, or Shift pass on.
 */
export function TileList(props: TileListProps): JSX.Element {
  const {moves, columns, spaceKey, selected, onActivate} = props;
  const listRef = useRef<HTMLDivElement>(null);
  const [focusStop, setFocusStop] = useState(0);
  const followsSelection = props.arrowsMove === 'selection';
  const tabStop = followsSelection ? (selected ?? 0) : focusStop;
  useFocusFollowsSelection(listRef, followsSelection ? selected : undefined);
  useLayoutEffect(() => {
    if (listRef.current !== null) keepOneTabStop(listRef.current, tabStop);
  });

  const activeIndex = (list: HTMLElement, target: EventTarget): number => {
    const tile = tileOf(target);
    return tile === null || isDisabled(tile) ? -1 : indexOf(list, tile);
  };
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const index = activeIndex(event.currentTarget, event.target);
    if (index >= 0) onActivate(index);
  };
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const index = activeIndex(event.currentTarget, event.target);
    if (index >= 0) props.onDoubleClick?.(index);
  };
  const onContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    const index = indexOf(event.currentTarget, tileOf(event.target));
    if (index < 0 || props.onMenu === undefined) return;
    event.preventDefault();
    props.onMenu(index, {
      kind: 'point',
      point: {x: event.clientX, y: event.clientY},
    });
  };
  const openMenuFromKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const tile = tileOf(event.target);
    const index = indexOf(event.currentTarget, tile);
    if (tile === null || index < 0 || props.onMenu === undefined) return;
    event.preventDefault();
    props.onMenu(index, {kind: 'element', element: tile});
  };
  const moveTo = (list: HTMLElement, target: number): void => {
    if (props.arrowsMove === 'selection') props.onSelect(target);
    else tilesOf(list)[target]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isMenuKey(event)) {
      openMenuFromKey(event);
      return;
    }
    const move = moves[event.key];
    if (move === undefined || hasModifier(event)) return;
    event.preventDefault();
    const list = event.currentTarget;
    const current = indexOf(list, tileOf(event.target));
    const target = current + move(columnCount(list, columns));
    if (current < 0 || target < 0 || target >= tilesOf(list).length) return;
    moveTo(list, target);
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    // NOTE(0913vision): A button clicks on the Space key's keyup. With `pass`
    // only that click is cancelled; the keydown still reaches the window.
    if (spaceKey === 'pass' && event.key === SPACE) event.preventDefault();
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (followsSelection) return;
    const index = indexOf(event.currentTarget, tileOf(event.target));
    if (index >= 0) setFocusStop(index);
  };

  return (
    <div
      {...(props.takesClickFocus === true ? clickFocusProps : undefined)}
      ref={listRef}
      role="listbox"
      aria-label={props.label}
      className={props.className}
      style={props.style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onFocus={onFocus}
    >
      {props.children}
    </div>
  );
}
