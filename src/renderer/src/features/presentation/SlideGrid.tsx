import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  memo,
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
  retainShownGrid,
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
import {splitSourceFor} from '../bible/splitProjection';
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
  readonly prebuild?: boolean;
  /** The columns of the size class at 100%: 3, 4, or 6. */
  readonly columns: number;
  /** The 슬라이드 size in percent, 50 to 200. */
  readonly scalePercent: number;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}

function SlideGridContent({
  active = true,
  prebuild = false,
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const openItemId = useShownItemId();
  const currentBibleLookup = useShow(view => isBibleSource(view, openItemId));
  const [lastBibleLookup, setLastBibleLookup] = useState(currentBibleLookup);
  if ((active || prebuild) && lastBibleLookup !== currentBibleLookup) {
    setLastBibleLookup(currentBibleLookup);
  }
  const bibleLookup = active || prebuild ? currentBibleLookup : lastBibleLookup;
  const offset = useShow(view =>
    openItemId === null ? null : serviceSlideOffset(view, openItemId),
  );
  const currentTiles = useShow(view => shownTilesFor(view, openItemId));
  const [lastTiles, setLastTiles] = useState(currentTiles);
  if (
    (active || prebuild) &&
    currentTiles !== undefined &&
    lastTiles !== currentTiles
  ) {
    setLastTiles(currentTiles);
  }
  const tiles = active || prebuild ? currentTiles : lastTiles;
  const row = useShow(view => view.rows.find(value => value.id === openItemId));
  const serviceId = useShow(view => view.serviceId);
  const serviceItem = row !== undefined && isItemRow(row);
  const needsBibleProjection = useShow(
    view => openItemId !== null && splitSourceFor(view, openItemId) !== null,
  );
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
  const currentBible = useBibleTileProjection({
    itemId: openItemId,
    anyItem: true,
  });
  const [lastBible, setLastBible] = useState(currentBible);
  if (
    (active || prebuild) &&
    currentBible !== null &&
    lastBible !== currentBible
  ) {
    setLastBible(currentBible);
  }
  const bible = active || prebuild ? currentBible : lastBible;
  const liveSlide = useLive(view => view.state?.layers.slide ?? null);
  const liveIndex = useShow(view =>
    liveTileIndex({...view, openItemId}, liveSlide),
  );
  // NOTE(0913vision): Tiles of an item the grid switches to wait for their
  // pictures, holding the grid as it was; tiles a scroll or resize brings in
  // draw where they show.
  const committedItem = useCommittedShownItem();
  const [localItem, setLocalItem] = useState<string | null | undefined>();
  const keeperRef = useRef<HTMLDivElement>(null);
  if (
    !prebuild &&
    active &&
    committedItem === openItemId &&
    localItem !== openItemId
  ) {
    setLocalItem(openItemId);
  }
  const switching =
    !prebuild &&
    active &&
    localItem !== openItemId &&
    committedItem !== openItemId;
  useLayoutEffect(() => {
    if (!active) return;
    commitShownItem(openItemId);
  }, [active, openItemId]);
  useEffect(() => {
    if (
      serviceId === null ||
      openItemId === null ||
      !serviceItem ||
      (!prebuild && localItem !== openItemId) ||
      (prebuild &&
        (row.problem === 'loading-bible' ||
          (needsBibleProjection && currentBible === null)))
    ) {
      return;
    }
    const root = keeperRef.current;
    if (root === null) return;
    let release: (() => void) | undefined;
    let generation = 0;
    const update = (): void => {
      const revision = ++generation;
      const pending = root.querySelector('[data-preview-ready="false"]');
      const images = [...root.querySelectorAll('img')];
      const tiles = [...root.querySelectorAll('[role="option"]')];
      const ready =
        (prebuild
          ? tiles.length === (currentTiles?.length ?? 0)
          : tiles.length > 0) &&
        pending === null &&
        tiles.every(
          tile =>
            tile.querySelector('[data-preview-ready="true"], img') !== null,
        ) &&
        images.every(image => image.complete && image.naturalWidth > 0);
      if (ready && release === undefined) {
        Promise.all(
          images.map(image =>
            typeof image.decode === 'function'
              ? image.decode()
              : Promise.resolve(),
          ),
        ).then(
          () => {
            if (revision === generation && release === undefined) {
              release = retainShownGrid(serviceId, openItemId);
            }
          },
          (error: unknown) => {
            globalThis.window.llp?.log.write({
              level: 'warn',
              message: 'Could not decode a service grid picture',
              detail: String(error),
            });
          },
        );
      } else if (!ready && release !== undefined) {
        release();
        release = undefined;
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-preview-ready', 'src'],
    });
    root.addEventListener('load', update, true);
    root.addEventListener('error', update, true);
    update();
    return () => {
      generation++;
      observer.disconnect();
      root.removeEventListener('load', update, true);
      root.removeEventListener('error', update, true);
      release?.();
    };
  }, [
    serviceId,
    openItemId,
    serviceItem,
    localItem,
    prebuild,
    tiles,
    currentTiles,
    needsBibleProjection,
    currentBible,
    row,
  ]);
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
  const reflowIds = tileReflowIds(tiles ?? [], openItemId ?? '');
  useReflow(keeperRef, {
    ids: reflowIds,
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: openItemId,
    enabled: active,
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
  const {width, gap} = useGridMeasure(keeperRef, GRID_SELECTOR, active);
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
    enabled: active,
  });
  const start = prebuild ? 0 : window.start;
  const end = prebuild ? (tiles?.length ?? 0) : window.end;
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

      <div
        className={styles.window}
        style={{top: prebuild ? 0 : window.offset}}
      >
        <ThumbnailGrid
          workspace="show"
          gridFocus
          label="슬라이드"
          columns={columns}
          tileWidth={tileWidth}
          positionOffset={start}
          setSize={tiles?.length ?? 0}
          selected={undefined}
          onSelect={() => undefined}
          onOutput={index => onOutput(start + index)}
          onMenu={(index, anchor) => {
            if (openItemId !== null) {
              setMenu({
                itemId: openItemId,
                index: start + index,
                anchor,
              });
            }
          }}
          className={styles.grid}
        >
          {tiles?.slice(start, end).map((tile, local) => {
            const index = start + local;
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

/** The 슬라이드 grid of the open item. A click outputs a tile. */
export const SlideGrid = memo(SlideGridContent);
