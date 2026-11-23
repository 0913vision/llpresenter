import {
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import {useShow} from '@renderer/session/show';
import {
  isBibleSource,
  liveTileIndex,
  shownTilesFor,
} from '@renderer/session/showLibrary';
import {useLive} from '@renderer/session/live';
import {commitShownItem, useShownItemId} from '@renderer/session/shownItem';
import {thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import styles from './SlideGrid.module.css';
import {useSlideWindow} from './useSlideWindow';
import {ShowTileMenu, ShowTiles, type TileMenu} from './ShowTiles';
import {ShowSlideEntry} from './showPanelNavigation';
import {serviceSlideOffset} from './serviceSlideNumbers';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import {tileReflowIds} from './tileReflowIds';
import {useReflow} from '@renderer/ui/useReflow';

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
  const openItemId = useShownItemId();
  const bibleLookup = useShow(view => isBibleSource(view, openItemId));
  const offset = useShow(view =>
    openItemId === null ? null : serviceSlideOffset(view, openItemId),
  );
  const tiles = useShow(view => shownTilesFor(view, openItemId));
  const liveSlide = useLive(view => view.state?.layers.slide ?? null);
  const liveIndex = useShow(view =>
    liveTileIndex({...view, openItemId}, liveSlide),
  );
  useLayoutEffect(() => {
    commitShownItem(openItemId);
  }, [openItemId]);
  const transitionProgress = useSlideTransitionProgress();
  useEffect(() => {
    if (liveIndex !== null) useShow.setState({selectedTile: liveIndex});
  }, [liveIndex, openItemId]);
  const [menu, setMenu] = useState<TileMenu | null>(null);
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
  }, []);
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
    if (!entryRef) return;
    entryRef.current = enter;
    return () => {
      entryRef.current = null;
    };
  }, [entryRef]);

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
      <div className={styles.window} style={{top: window.offset}}>
        <ShowTiles
          itemId={openItemId}
          tiles={tiles ?? []}
          start={window.start}
          end={window.end}
          numberOffset={offset ?? 0}
          columns={columns}
          tileWidth={tileWidth}
          live={liveIndex}
          progress={transitionProgress}
          onMenu={setMenu}
          className={styles.grid}
        />
      </div>
      {menu !== null && menu.itemId === openItemId && tiles?.[menu.index] ? (
        <ShowTileMenu
          menu={menu}
          onOpenPrep={onOpenPrep}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
