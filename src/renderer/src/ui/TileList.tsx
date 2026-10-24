import {
  useEffect,
  useRef,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
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

export interface TileListProps {
  /** The list name for assistive technology, such as 장 or 매크로. */
  readonly label: string;
  readonly moves: TileMoves;
  /** The column count that ↑ and ↓ move by. */
  readonly columns: number;
  readonly spaceKey: TileSpaceKey;
  /**
   * Takes keyboard focus on a mouse click also in 진행, as the 장 grid does.
   * Other tile lists leave focus where it was there
   * (docs/spec/10-shortcuts-and-settings.md).
   */
  readonly takesClickFocus?: boolean | undefined;
  /**
   * The index of the selected tile, which takes the Tab stop. While it is
   * `undefined`, the list takes the Tab stop and passes focus to the first one.
   */
  readonly selected: number | undefined;
  /** An arrow key moved the selection. */
  readonly onSelect: (index: number) => void;
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

function useFocusFollowsSelection(selected: number | undefined) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (selected === undefined || !list?.contains(document.activeElement)) {
      return;
    }
    const tile = tilesOf(list)[selected];
    if (tile !== document.activeElement) tile?.focus();
  }, [selected]);
  return listRef;
}

/**
 * A listbox of tiles that Tab enters once: the 장 grid, the media grid and
 * strip, and the macro grid build on it. The arrow keys move the selection,
 * and while focus is in the list, it follows the selection, also when another
 * command moves it. Keys with Ctrl, Alt, or Shift pass on.
 */
export function TileList(props: TileListProps): JSX.Element {
  const {moves, columns, spaceKey, selected, onSelect, onActivate} = props;
  const listRef = useFocusFollowsSelection(selected);

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
    const target = current + move(columns);
    if (current < 0 || target < 0 || target >= tilesOf(list).length) return;
    onSelect(target);
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    // NOTE(0913vision): A button clicks on the Space key's keyup. With `pass`
    // only that click is cancelled; the keydown still reaches the window.
    if (spaceKey === 'pass' && event.key === SPACE) event.preventDefault();
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      tilesOf(event.currentTarget)[0]?.focus();
    }
  };

  return (
    <div
      {...(props.takesClickFocus === true ? clickFocusProps : undefined)}
      ref={listRef}
      role="listbox"
      aria-label={props.label}
      tabIndex={selected === undefined ? 0 : -1}
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
