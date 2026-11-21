import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import {outputTile, useShow} from '@renderer/session/show';
import {
  isBibleSource,
  liveTileIndex,
  shownTilesFor,
} from '@renderer/session/showLibrary';
import {useLive} from '@renderer/session/live';
import {
  commitShownItem,
  useCommittedShownItem,
  useShownItemId,
} from '@renderer/session/shownItem';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {isItemRow} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import {useBibleTileProjection} from '../bible/useBibleProjections';
import {BibleLoadNotice} from '../bible/BibleLoadNotice';
import styles from './SlideGrid.module.css';
import {useSlideWindow} from './useSlideWindow';
import {ShowSlideEntry} from './showPanelNavigation';
import {serviceSlideOffset} from './serviceSlideNumbers';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import {tilePicture} from './tilePicture';
import {tileReflowIds} from './tileReflowIds';
import {useReflow} from '@renderer/ui/useReflow';

const GRID_SELECTOR = '[role="listbox"]';

export interface SlideGridProps {
  readonly active?: boolean;
  /** The columns of the size class at 100%: 3, 4, or 6. */
  readonly columns: number;
  /** The 슬라이드 size in percent, 50 to 200. */
  readonly scalePercent: number;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}

/** The 슬라이드 grid of the open item. A click outputs a tile. */
export function SlideGrid({
  active = true,
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const openItemId = useShownItemId();
  const bibleLookup = useShow(view => isBibleSource(view, openItemId));
  const offset = useShow(view =>
    openItemId === null ? null : serviceSlideOffset(view, openItemId),
  );
  const tiles = useShow(view => shownTilesFor(view, openItemId));
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
  const card = tiles?.find(tile => tile.sectionCard !== undefined)?.sectionCard;
  const cardTheme = useSlideTheme(
    card === undefined || openItemId === null
      ? undefined
      : {
          id: openItemId,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  const sermonTheme = useSlideTheme(
    row?.kind === 'bible' &&
      row.sermonTitle !== undefined &&
      row.bible !== undefined
      ? sermonPreviewRow(row.id, row.bible.ref)
      : undefined,
  );
  const bible = useBibleTileProjection({itemId: openItemId, anyItem: true});
  const liveSlide = useLive(view => view.state?.layers.slide ?? null);
  const liveIndex = useShow(view =>
    liveTileIndex({...view, openItemId}, liveSlide),
  );
  // NOTE(0913vision): Tiles of an item the grid switches to wait for their
  // pictures, holding the grid as it was; tiles a scroll or resize brings in
  // draw where they show.
  const committedItem = useCommittedShownItem();
  const switching = active && committedItem !== openItemId;
  useLayoutEffect(() => {
    if (active) commitShownItem(openItemId);
  }, [active, openItemId]);
  const transitionProgress = useSlideTransitionProgress();
  useEffect(() => {
    if (active && liveIndex !== null) {
      useShow.setState({selectedTile: liveIndex});
    }
  }, [active, liveIndex, openItemId]);
  const [menu, setMenu] = useState<{
    itemId: string;
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const keeperRef = useRef<HTMLDivElement>(null);
  const reflowIds = tileReflowIds(tiles ?? [], openItemId ?? '');
  useReflow(keeperRef, {
    ids: reflowIds,
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: openItemId,
  });
  const tabEntry = useRef(false);
  const [showFocus, setShowFocus] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const keyDown = (event: globalThis.KeyboardEvent): void => {
      tabEntry.current = event.key === 'Tab';
    };
    const pointerDown = (): void => {
      tabEntry.current = false;
      setShowFocus(false);
    };
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('pointerdown', pointerDown, true);
    return () => {
      document.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('pointerdown', pointerDown, true);
    };
  }, [active]);
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
    startAtTop: bibleLookup,
  });
  const entryRef = useContext(ShowSlideEntry);
  const enter = useEffectEvent(() => {
    if (liveIndex !== null) window.reveal();
    keeperRef.current
      ?.querySelector<HTMLElement>(GRID_SELECTOR)
      ?.focus({preventScroll: true});
  });
  useEffect(() => {
    if (!entryRef || !active) return;
    entryRef.current = enter;
    return () => {
      entryRef.current = null;
    };
  }, [active, entryRef]);

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
      data-tab-focus={showFocus ? 'true' : undefined}
      onFocusCapture={() => setShowFocus(tabEntry.current)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setShowFocus(false);
        }
      }}
      data-show-slide-grid="true"
      data-slide-window-size={window.windowSize}
      style={{height: window.height}}
    >
      {row !== undefined && row.kind !== 'header' ? (
        <BibleLoadNotice row={row} />
      ) : null}

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
            return (
              <SlideThumbnail
                key={reflowIds[index] ?? `${openItemId}:${index}`}
                reflowId={reflowIds[index]}
                selectionStyle="plate"
                number={(offset ?? 0) + index + 1}
                canvas={tilePicture(tile, slide, {
                  theme,
                  cardTheme,
                  sermonTheme,
                  bibleAppearance: bible?.appearance,
                  switchSlot: switching ? `${openItemId}:${index}` : undefined,
                })}
                label={
                  (tile.slideLabel ?? tile.label) === ''
                    ? undefined
                    : (tile.slideLabel ?? tile.label ?? undefined)
                }
                labelColor={tile.labelColor}
                accessibleLabel={
                  picture === undefined || tile.slideLabel || tile.label
                    ? undefined
                    : tile.lines.join(' ')
                }
                text={picture === undefined ? tile.lines.join('\n') : undefined}
                media={
                  picture === undefined ? undefined : thumbnailSrc(picture)
                }
                live={index === liveIndex}
                transitionProgress={
                  index === liveIndex ? transitionProgress : undefined
                }
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
