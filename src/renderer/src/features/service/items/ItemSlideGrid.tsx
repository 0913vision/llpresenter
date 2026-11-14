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
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {OverlayWarning} from '../details/ItemThemeRow';
import {OverlayClips} from './OverlayClip';
import type {ServiceItemStore} from './serviceItemStore';
import {openItemSong} from './openItemSong';
import {useItemSlides, type ItemSlide} from './useItemSlides';
import {useOverlayControl} from './useOverlayControl';
import {useOverlayEditing} from './useOverlayEditing';
import styles from './ItemOverlays.module.css';

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
  const rawSlides = useItemSlides(items, editor);
  const songTheme = useSlideTheme(
    state.item !== null && isItemOfKind(state.item, 'song')
      ? {
          id: state.item.id,
          kind: 'song',
          title: state.song?.history.snapshot.song.title ?? '',
          ...(state.item.theme === undefined ? {} : {theme: state.item.theme}),
        }
      : undefined,
  );
  const bible = state.item !== null && isItemOfKind(state.item, 'bible');
  const offset = bible ? cardOffset(state.item) : 0;
  const projection = useBibleTileProjection({
    itemId: bible ? state.item.id : null,
    ...(state.service === null ? {} : {serviceId: state.service.service.id}),
  });
  const slides = useMemo<readonly ItemSlide[]>(
    () =>
      projection?.tiles.map(tile => ({
        text: tile.lines.join('\n'),
        label: tile.label ?? undefined,
        color: tile.labelColor,
        media: undefined,
      })) ?? rawSlides,
    [projection, rawSlides],
  );
  const grid = useRef<HTMLDivElement>(null);
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
    count: slides.length,
    reason,
    change: change => items.changeOverlays(change),
  });
  const control = useOverlayControl(editing);
  if (state.item === null) return <></>;
  const song = isItemOfKind(state.item, 'song');
  const selected = Math.min(
    Math.max(0, state.position - offset),
    Math.max(0, slides.length - 1),
  );
  const edit = (index: number): void => {
    if (song) openItemSong({items, editor, position: index});
  };
  const canvasFor = (index: number): JSX.Element | undefined => {
    const songSlide = slides[index];
    if (songTheme !== undefined && songSlide !== undefined) {
      return (
        <SlidePicture
          {...songTheme}
          slide={{
            itemId: state.item?.id ?? 'thumbnail',
            position: index,
            label: songSlide.label ?? null,
            lines: songSlide.text.split('\n'),
            ...(songSlide.titleSlide === undefined
              ? {}
              : {titleSlide: songSlide.titleSlide}),
            ...(songSlide.titleLayout === undefined
              ? {}
              : {titleLayout: songSlide.titleLayout}),
            ...(songSlide.lyricFormat === undefined
              ? {}
              : {lyricFormat: songSlide.lyricFormat}),
          }}
        />
      );
    }
    const appearance = projection?.appearance;
    const layer =
      projection === null
        ? null
        : slideLayerOf(
            {itemId: projection.source.id, index},
            () => projection.tiles,
          );
    return appearance === undefined || layer === null ? undefined : (
      <SlidePicture
        slide={layer}
        layout={appearance.theme.layout}
        emptyColor={appearance.theme.emptyColor}
        item={appearance.theme.item}
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
          selected={slides.length === 0 ? undefined : selected}
          onSelect={index => items.selectPosition(index + offset)}
          onMenu={(index, anchor) => {
            items.selectPosition(index + offset);
            setMenu({index, anchor});
          }}
        >
          {slides.map((slide, index) => (
            <SlideThumbnail
              key={index}
              number={index + 1 + offset}
              selectionStyle="plate"
              label={slide.label === '' ? undefined : slide.label}
              labelColor={slide.color}
              text={slide.media === undefined ? slide.text : undefined}
              canvas={canvasFor(index)}
              media={
                slide.media === undefined
                  ? undefined
                  : thumbnailSrc(slide.media)
              }
              selected={index === selected}
            />
          ))}
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
