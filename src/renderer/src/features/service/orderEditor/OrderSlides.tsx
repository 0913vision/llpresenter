import {useState, type JSX} from 'react';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {OrderEditorOverlayClips} from './OverlayClips';
import type {OrderTile} from './orderEditorModel';
import styles from './OrderEditor.module.css';

const GRID_LABEL = '슬라이드';
const BASELINE_COLUMNS = 4;

export interface OrderSlidesProps {
  readonly tiles: readonly OrderTile[];
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
  /** The tile width in CSS pixels. */
  readonly tileWidth: number;
  /** Opens 곡 편집 at a slide of the song, by its place in the song. */
  readonly onEditSong: (block: number) => void;
}

function slideMenuEntries(
  tile: OrderTile,
  onEditSong: (block: number) => void,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'edit-song',
      label: '곡 편집…',
      onSelect: () => onEditSong(tile.block),
    },
  ];
}

/** The slides of the order, filling rows to the window width. */
export function OrderSlides({
  tiles,
  selected,
  onSelect,
  tileWidth,
  onEditSong,
}: OrderSlidesProps): JSX.Element {
  const [menu, setMenu] = useState<{
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const menuTile = menu === null ? undefined : tiles[menu.index];
  return (
    <div className={styles.slides}>
      <ThumbnailGrid
        workspace="prep"
        label={GRID_LABEL}
        columns={BASELINE_COLUMNS}
        tileWidth={tileWidth}
        selected={selected}
        onSelect={onSelect}
        onMenu={(index, anchor) => setMenu({index, anchor})}
      >
        {tiles.map(tile => (
          <SlideThumbnail
            key={tile.key}
            number={tile.number}
            label={tile.label}
            labelColor={tile.color}
            text={tile.text}
            selected={tile.number - 1 === selected}
          />
        ))}
      </ThumbnailGrid>
      <OrderEditorOverlayClips />
      {menu !== null && menuTile !== undefined ? (
        <Menu
          label={GRID_LABEL}
          anchor={menu.anchor}
          entries={slideMenuEntries(menuTile, onEditSong)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
