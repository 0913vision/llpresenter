import {cardOffset} from '@core/services/sectionCards';
import {sectionCardEntries} from './sectionCardActions';
import {useMemo, useRef, useState, useSyncExternalStore, type JSX} from 'react';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {isItemOfKind} from '@core/schema/service';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuSeparator} from '@renderer/ui/menuRows';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useThumbnailScale} from '@renderer/platform/thumbnailScale';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import {itemThemes, useThemeSettings} from '@renderer/pictures/itemThemes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {useShow} from '@renderer/session/show';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {OverlayWarning} from '../details/ItemThemeRow';
import {OverlayClips} from './OverlayClip';
import type {ServiceItemStore} from './serviceItemStore';
import {openItemSong} from './openItemSong';
import {useOverlayControl} from './useOverlayControl';
import {useOverlayEditing} from './useOverlayEditing';
import styles from './ItemOverlays.module.css';
import {useReflow} from '@renderer/ui/useReflow';

const GRID_LABEL = '슬라이드';
const COLUMNS = 4;
const TILE_WIDTH = 128;

/** The slides of the open item as thumbnails, with its 오버레이 clips under them. */
export function ItemSlideGrid({
  items,
  editor,
  sizeClass = 'normal',
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly sizeClass?: SizeClass;
}): JSX.Element {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const itemId = state.item?.id;
  const row = useShow(view => view.rows.find(entry => entry.id === itemId));
  const saved = useShow(view =>
    itemId === undefined ? undefined : view.tiles[itemId],
  );
  const themes = itemThemes(row, saved ?? [], useThemeSettings());
  const bible = state.item !== null && isItemOfKind(state.item, 'bible');
  const offset = bible ? cardOffset(state.item) : 0;
  const tiles = useMemo(
    () => (saved ?? []).filter(tile => tile.sectionCard === undefined),
    [saved],
  );
  const grid = useRef<HTMLDivElement>(null);
  const counts = new Map<string, number>();
  const reflowIds = tiles.map(tile => {
    const identity = tile.key ?? JSON.stringify(tile.lines);
    const occurrence = counts.get(identity) ?? 0;
    counts.set(identity, occurrence + 1);
    return `${identity}:${occurrence}`;
  });
  useReflow(grid, {
    ids: reflowIds,
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: state.item?.id ?? null,
  });
  const {width, gap} = useGridMeasure(grid, '[role="listbox"]');
  const scale = useThumbnailScale(sizeClass);
  const tileWidth = bible
    ? thumbnailWidth({
        gridWidth: width,
        gap,
        columns: defaultThumbnailColumns[sizeClass],
        scalePercent: scale,
      })
    : TILE_WIDTH;
  const [menu, setMenu] = useState<{
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const reason =
    state.service?.access === 'readOnly'
      ? NEWER_FILE_REASON
      : state.busy
        ? '저장 중'
        : undefined;
  const {editing, missing} = useOverlayEditing({
    api: editor.api,
    item: state.item,
    count: tiles.length,
    reason,
    change: change => items.changeOverlays(change),
  });
  const control = useOverlayControl(editing);
  if (state.item === null) return <></>;
  const song = isItemOfKind(state.item, 'song');
  const selected = Math.min(
    Math.max(0, state.position - offset),
    Math.max(0, tiles.length - 1),
  );
  const edit = (index: number): void => {
    if (song) openItemSong({items, editor, position: index});
  };
  const canvasFor = (index: number): JSX.Element | undefined => {
    const tile = tiles[index];
    if (tile === undefined || itemId === undefined) return undefined;
    if (tile.media !== undefined && tile.texts === undefined) return undefined;
    return (
      <TilePicture
        tile={tile}
        slide={slideLayerOf({itemId, index}, () => tiles)}
        themes={themes}
      />
    );
  };
  return (
    <div
      ref={grid}
      key={`${state.service?.service.id}:${state.item.id}`}
      className={styles.slideList}
    >
      {missing.length === 0 ? null : (
        <div className={styles.warningRow}>
          <OverlayWarning missing={missing} />
        </div>
      )}
      <div
        className={styles.grid}
        onDoubleClick={event => {
          const tile =
            event.target instanceof Element
              ? event.target.closest('[role="option"]')
              : null;
          const index =
            tile === null
              ? -1
              : Array.from(
                  event.currentTarget.querySelectorAll('[role="option"]'),
                ).indexOf(tile);
          if (index >= 0) edit(index);
        }}
      >
        <ThumbnailGrid
          workspace="prep"
          label={GRID_LABEL}
          columns={COLUMNS}
          tileWidth={tileWidth}
          selected={tiles.length === 0 ? undefined : selected}
          onSelect={index => items.selectPosition(index + offset)}
          onMenu={(index, anchor) => {
            items.selectPosition(index + offset);
            setMenu({index, anchor});
          }}
        >
          {tiles.map((tile, index) => {
            const media =
              state.item !== null &&
              isItemOfKind(state.item, 'media') &&
              tile.texts === undefined
                ? state.item.media
                : undefined;
            return (
              <SlideThumbnail
                key={reflowIds[index] ?? index}
                reflowId={reflowIds[index]}
                number={index + 1 + offset}
                selectionStyle="plate"
                label={tile.slideLabel ?? tile.label ?? undefined}
                labelColor={tile.labelColor}
                text={media === undefined ? tile.lines.join('\n') : undefined}
                canvas={canvasFor(index)}
                media={media === undefined ? undefined : thumbnailSrc(media)}
                selected={index === selected}
              />
            );
          })}
        </ThumbnailGrid>
        <OverlayClips control={control} />
        {menu === null ? null : (
          <Menu
            context
            label="슬라이드 메뉴"
            anchor={menu.anchor}
            onClose={() => setMenu(null)}
            entries={[
              ...slideMenuEntries(
                song ? () => edit(menu.index) : undefined,
                song
                  ? {
                      open: () =>
                        openItemSong({
                          items,
                          editor,
                          position: menu.index,
                          action: 'hot-key',
                        }),
                      ...(state.song?.readOnly
                        ? {reason: NEWER_FILE_REASON}
                        : {}),
                    }
                  : undefined,
              ),
              ...(bible ? sectionCardEntries(items) : []),
              menuSeparator('overlay-separator'),
              ...control.entries(menu.index + 1),
            ]}
          />
        )}
      </div>
    </div>
  );
}
