import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type JSX,
} from 'react';
import {outputTile, useShow} from '@renderer/session/show';
import {shownTiles, useLiveTileIndex} from '@renderer/session/showLibrary';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {isItemRow} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {useBibleTileProjection} from '../bible/useBibleProjections';
import styles from './SlideGrid.module.css';
import {useSlideWindow} from './useSlideWindow';
import {ShowSlideEntry} from './showPanelNavigation';

const GRID_SELECTOR = '[role="listbox"]';

export interface SlideGridProps {
  /** The columns of the size class at 100%: 3, 4, or 6. */
  readonly columns: number;
  /** The 슬라이드 size in percent, 50 to 200. */
  readonly scalePercent: number;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}

/** The 슬라이드 grid of the open item. A click outputs a tile. */
export function SlideGrid({
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const openItemId = useShow(view => view.openItemId);
  const tiles = useShow(shownTiles);
  const row = useShow(view => view.rows.find(value => value.id === openItemId));
  const librarySong = useShow(view => view.librarySong);
  const theme = useSlideTheme(
    row !== undefined && isItemRow(row)
      ? row
      : librarySong === null
        ? undefined
        : {
            id: `library:${librarySong.songId}`,
            kind: 'song',
            title: librarySong.title,
            ...(librarySong.background === undefined
              ? {}
              : {background: librarySong.background}),
          },
    row === undefined ? 'external' : 'service',
  );
  const bible = useBibleTileProjection({itemId: openItemId});
  const liveIndex = useLiveTileIndex();
  useEffect(() => {
    if (liveIndex !== null) useShow.setState({selectedTile: liveIndex});
  }, [liveIndex, openItemId]);
  const [menu, setMenu] = useState<{
    itemId: string;
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const keeperRef = useRef<HTMLDivElement>(null);
  const {width, gap} = useGridMeasure(keeperRef, GRID_SELECTOR);
  const tileWidth = thumbnailWidth({
    gridWidth: width,
    columns,
    gap,
    scalePercent,
  });
  const window = useSlideWindow(keeperRef, {
    count: tiles?.length ?? 0,
    columns,
    tileWidth,
    width,
    gap,
    live: liveIndex,
    itemId: openItemId,
    onOutput: index => {
      if (openItemId !== null) outputTile({itemId: openItemId, index});
    },
  });
  const entryRef = useContext(ShowSlideEntry);
  const enter = useEffectEvent(() => {
    if (liveIndex !== null) window.reveal(liveIndex);
    keeperRef.current
      ?.querySelector<HTMLElement>(GRID_SELECTOR)
      ?.focus({preventScroll: true});
  });
  useEffect(() => {
    if (!entryRef) return;
    entryRef.current = enter;
    return () => {
      entryRef.current = null;
    };
  }, [entryRef]);

  const onOutput = useCallback(
    (index: number): void => {
      if (openItemId !== null) outputTile({itemId: openItemId, index});
    },
    [openItemId],
  );

  return (
    <div
      ref={keeperRef}
      className={styles.keeper}
      onKeyDownCapture={window.navigate}
      style={{height: window.height}}
    >
      <div className={styles.window} style={{top: window.offset}}>
        <ThumbnailGrid
          workspace="show"
          gridFocus
          label="슬라이드"
          columns={columns}
          tileWidth={tileWidth}
          positionOffset={window.start}
          setSize={tiles?.length ?? 0}
          selected={undefined}
          onSelect={() => undefined}
          onOutput={index => onOutput(window.start + index)}
          onMenu={(index, anchor) => {
            if (openItemId !== null) {
              setMenu({
                itemId: openItemId,
                index: window.start + index,
                anchor,
              });
            }
          }}
          className={styles.grid}
        >
          {tiles?.slice(window.start, window.end).map((tile, local) => {
            const index = window.start + local;
            const picture = tile.media?.mediaId;
            const slide =
              openItemId === null
                ? null
                : slideLayerOf({itemId: openItemId, index}, () => tiles);
            const appearance =
              tile.biblePart === undefined ? undefined : bible?.appearance;
            return (
              <SlideThumbnail
                key={index}
                selectionStyle="plate"
                number={index + 1}
                canvas={
                  appearance !== undefined && slide !== null ? (
                    <SlidePicture
                      slide={slide}
                      layout={appearance.theme.layout}
                      emptyColor={appearance.theme.emptyColor}
                      item={appearance.theme.item}
                      background={appearance.background}
                    />
                  ) : theme === undefined || slide === null ? undefined : (
                    <SlidePicture {...theme} slide={slide} />
                  )
                }
                label={
                  tile.label ??
                  (picture === undefined ? undefined : tile.lines.join(' '))
                }
                labelColor={tile.labelColor}
                text={picture === undefined ? tile.lines.join('\n') : undefined}
                media={
                  picture === undefined ? undefined : thumbnailSrc(picture)
                }
                live={index === liveIndex}
                hotKey={tile.hotKey}
              />
            );
          })}
        </ThumbnailGrid>
      </div>
      {menu !== null && menu.itemId === openItemId && tiles?.[menu.index] ? (
        <Menu
          context
          label="슬라이드"
          anchor={menu.anchor}
          entries={[
            {
              kind: 'item',
              id: 'output',
              contextGroup: 'default',
              label: '출력',
              onSelect: () => onOutput(menu.index),
            },
            ...slideMenuEntries(
              onOpenPrep === undefined
                ? undefined
                : () => onOpenPrep(menu.itemId, menu.index),
            ),
          ]}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
