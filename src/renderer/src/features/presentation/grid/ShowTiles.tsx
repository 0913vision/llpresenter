import type {JSX} from 'react';
import type {SlideTile} from '@core/presentation';
import {outputTile} from '@renderer/session/show/show';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import type {TransitionProgress} from '@renderer/ui/tiles/transitionProgress';
import {TilePicture, tileProps} from '@renderer/pictures/TilePicture';
import {showSlideMenuEntries} from './showSlideMenuEntries';
import {tileReflowIds} from './tileReflowIds';

/** The tile a 슬라이드 menu was opened on. */
export interface TileMenu {
  readonly itemId: string;
  readonly index: number;
  readonly anchor: MenuAnchor;
}

/**
 * The tiles `start` to `end` of one item in the 진행 슬라이드 grid. A click
 * outputs a tile; the menu key or a right-click asks for its menu.
 */
export function ShowTiles({
  itemId,
  tiles,
  start,
  end,
  numberOffset,
  columns,
  tileWidth,
  live,
  progress,
  onMenu,
  className,
}: {
  readonly itemId: string | null;
  readonly tiles: readonly SlideTile[];
  readonly start: number;
  readonly end: number;
  /** How many slides of the service come before the item. */
  readonly numberOffset: number;
  readonly columns: number;
  readonly tileWidth: number;
  /** The index of the live tile in the item. */
  readonly live: number | null;
  readonly progress: TransitionProgress | undefined;
  readonly onMenu: (menu: TileMenu) => void;
  readonly className: string | undefined;
}): JSX.Element {
  const ids = tileReflowIds(tiles, itemId ?? '');
  return (
    <ThumbnailGrid
      workspace="show"
      gridFocus
      label="슬라이드"
      columns={columns}
      tileWidth={tileWidth}
      positionOffset={start}
      setSize={tiles.length}
      selected={undefined}
      onSelect={() => undefined}
      onOutput={index => {
        if (itemId !== null) outputTile({itemId, index: start + index});
      }}
      onMenu={(index, anchor) => {
        if (itemId !== null) onMenu({itemId, index: start + index, anchor});
      }}
      className={className}
    >
      {tiles.slice(start, end).map((tile, local) => {
        const index = start + local;
        return (
          <SlideThumbnail
            key={ids[index] ?? `${itemId}:${index}`}
            reflowId={ids[index]}
            selectionStyle="plate"
            number={numberOffset + index + 1}
            canvas={<TilePicture tile={tile} />}
            live={index === live}
            transitionProgress={index === live ? progress : undefined}
            {...tileProps(tile)}
          />
        );
      })}
    </ThumbnailGrid>
  );
}

/** The menu of a tile in the 진행 슬라이드 grid. */
export function ShowTileMenu({
  menu,
  onOpenPrep,
  onClose,
}: {
  readonly menu: TileMenu;
  readonly onOpenPrep:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Menu
      context
      label="슬라이드"
      anchor={menu.anchor}
      entries={showSlideMenuEntries({
        output: () => outputTile({itemId: menu.itemId, index: menu.index}),
        edit:
          onOpenPrep === undefined
            ? undefined
            : () => onOpenPrep(menu.itemId, menu.index),
      })}
      onClose={onClose}
    />
  );
}
