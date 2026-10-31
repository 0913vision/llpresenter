import {contextMenuTarget, isContextMenuKey} from '@renderer/ui/contextMenu';
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
import {hasModifier} from './modifierKeys';
import {useButtonPress} from './press';
import type {Workspace} from './workspace';

const TILE = '[role="option"]';
const SPACE = ' ';
const ENTER = 'Enter';

/** How each arrow key moves the selection, given the column count. */
export type TileMoves = Readonly<Record<string, (columns: number) => number>>;

/** ↑ and ↓ only, one row at a time: the 슬라이드 grid of 진행. */
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
 * window, where 진행 uses it for 다음 슬라이드.
 */
export type TileSpaceKey = 'press' | 'pass';

/** The column count that ↑ and ↓ move by, or `auto` to read it from the layout. */
export type TileColumns = number | 'auto';

/** The props that every tile list takes. */
export interface TileListPosition {
  /** Zero-based start of a mounted window in the full list. */
  readonly positionOffset?: number | undefined;
  readonly setSize?: number | undefined;
  readonly orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface TileListBaseProps extends TileListPosition {
  /** The workspace for the grid's focus appearance; defaults to 준비. */
  readonly workspace?: Workspace | undefined;
  /** The list name for assistive technology, such as 슬라이드 or 매크로. */
  readonly label: string;
  readonly moves: TileMoves;
  readonly columns: TileColumns;
  readonly spaceKey: TileSpaceKey;
  /**
   * Takes keyboard focus on a mouse click also in 진행, as the 슬라이드 grid does.
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

interface SpaceHandlers {
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void;
}

// NOTE(0913vision): A button clicks on the Space key's keyup, even when the
// keydown had a modifier, so the list cancels that click. A list that presses
// with Space presses the tile itself, only on the keyup that ends a plain
// Space keydown on the same tile.
function useSpacePress(
  spaceKey: TileSpaceKey,
  press: (list: HTMLElement, tile: Element) => void,
): SpaceHandlers {
  const pressedTile = useRef<Element | null>(null);
  return {
    onKeyDown: event => {
      if (spaceKey === 'pass') return;
      if (hasModifier(event)) {
        pressedTile.current = null;
        return;
      }
      event.preventDefault();
      if (!event.repeat) pressedTile.current = tileOf(event.target);
    },
    onKeyUp: event => {
      event.preventDefault();
      const tile = pressedTile.current;
      pressedTile.current = null;
      if (tile !== null && tile === tileOf(event.target)) {
        press(event.currentTarget, tile);
      }
    },
  };
}

/**
 * A listbox of tiles that Tab enters once: the 슬라이드 grid, the media grid and
 * strip, and the macro grid build on it. It owns the Tab stop of its tiles,
 * so the tiles set no `tabIndex`. Keys with Ctrl, Alt, Shift, or the Windows
 * key pass on.
 */
export function TileList(props: TileListProps): JSX.Element {
  const {moves, columns, spaceKey, selected, onActivate} = props;
  const listRef = useRef<HTMLDivElement>(null);
  const [focusStop, setFocusStop] = useState(0);
  const offset =
    Number.isInteger(props.positionOffset) && (props.positionOffset ?? -1) >= 0
      ? (props.positionOffset ?? 0)
      : 0;
  const followsSelection = props.arrowsMove === 'selection';
  const tabStop = followsSelection
    ? (selected ?? 0)
    : Math.max(0, focusStop - offset);
  const positioned = useRef(false);
  useFocusFollowsSelection(listRef, followsSelection ? selected : undefined);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    keepOneTabStop(list, tabStop);
    const supplied =
      props.setSize !== undefined || props.positionOffset !== undefined;
    if (!supplied && !positioned.current) return;
    const tiles = tilesOf(list);
    const total = Number.isInteger(props.setSize)
      ? Math.max(props.setSize ?? 0, offset + tiles.length)
      : offset + tiles.length;
    tiles.forEach((tile, index) => {
      if (supplied) {
        tile.setAttribute('aria-posinset', String(offset + index + 1));
        tile.setAttribute('aria-setsize', String(total));
      } else {
        tile.removeAttribute('aria-posinset');
        tile.removeAttribute('aria-setsize');
      }
    });
    positioned.current = supplied;
  });

  const activeIndex = (list: HTMLElement, target: EventTarget): number => {
    const tile = tileOf(target);
    return tile === null || isDisabled(tile) ? -1 : indexOf(list, tile);
  };
  const activate = (list: HTMLElement, target: EventTarget): void => {
    const index = activeIndex(list, target);
    if (index >= 0) onActivate(index);
  };
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    activate(event.currentTarget, event.target);
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
      target: contextMenuTarget(event),
      point: {x: event.clientX, y: event.clientY},
    });
  };
  const openMenuFromKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const tile = tileOf(event.target);
    const index = indexOf(event.currentTarget, tile);
    if (tile === null || index < 0 || props.onMenu === undefined) return;
    event.preventDefault();
    props.onMenu(index, {
      kind: 'element',
      target: contextMenuTarget(event),
      element: tile,
    });
  };
  const moveTo = (list: HTMLElement, target: number): void => {
    if (props.arrowsMove === 'selection') props.onSelect(target);
    else tilesOf(list)[target]?.focus();
  };
  const pressOnEnter = (event: KeyboardEvent<HTMLDivElement>): void => {
    // NOTE(0913vision): A button clicks on every Enter keydown, held or with
    // a modifier, so the list cancels that click and presses the tile only
    // once per plain press (spec 10).
    if (hasModifier(event)) return;
    event.preventDefault();
    if (!event.repeat) {
      activate(event.currentTarget, event.target);
    }
  };
  const moveOnArrow = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = moves[event.key];
    if (move === undefined || hasModifier(event)) return;
    event.preventDefault();
    const list = event.currentTarget;
    const current = indexOf(list, tileOf(event.target));
    const target = current + move(columnCount(list, columns));
    if (current < 0 || target < 0 || target >= tilesOf(list).length) return;
    moveTo(list, target);
  };
  const space = useSpacePress(spaceKey, activate);
  // NOTE(0913vision): Every key the list takes is cancelled on keydown, so the
  // 진행 handler leaves it alone; a Space that the list passes on reaches it.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isContextMenuKey(event)) openMenuFromKey(event);
    else if (event.key === ENTER) pressOnEnter(event);
    else if (event.key === SPACE) space.onKeyDown(event);
    else moveOnArrow(event);
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === SPACE) space.onKeyUp(event);
  };
  const press = useButtonPress<HTMLDivElement>({
    disabled: false,
    onPress: onClick,
    onKeyDown,
    onKeyUp,
  });
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (followsSelection) return;
    const index = indexOf(event.currentTarget, tileOf(event.target));
    if (index >= 0) setFocusStop(offset + index);
  };

  return (
    <div
      {...(props.takesClickFocus === true ? clickFocusProps : undefined)}
      {...press}
      ref={listRef}
      role="listbox"
      data-workspace={props.workspace ?? 'prep'}
      aria-label={props.label}
      aria-orientation={props.orientation}
      className={props.className}
      style={props.style}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onFocus={onFocus}
    >
      {props.children}
    </div>
  );
}
