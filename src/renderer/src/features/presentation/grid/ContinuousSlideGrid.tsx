import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {ServiceRow, SlideTile} from '@core/presentation';
import {useLive} from '@renderer/session/live';
import {
  projectedLiveCursor,
  tilesForView,
} from '@renderer/session/show/showLibrary';
import type {ShowView} from '@renderer/session/show/showStore';
import {thumbnailWidth} from '@renderer/ui';
import {firstSlideWindowSize} from './useSlideWindow';
import {useGridMeasure} from '@renderer/ui/lists/useGridMeasure';
import {useSlideTransitionProgress} from '../useSlideTransitionProgress';
import {revealSlideItem} from '@renderer/session/show/visibleSlideItem';
import {liveReturn} from './liveReturn';
import type {SlideGridProps} from './SlideGrid';
import {ShowSlideEntry} from '../keyboard/showPanelNavigation';
import styles from './SlideGrid.module.css';
import {tileReflowIds} from './tileReflowIds';
import {useReflow} from '@renderer/ui/panels/useReflow';
import {useContinuousViewport} from './useContinuousViewport';
import {ShowTileMenu, ShowTiles, type TileMenu} from './ShowTiles';
import {useShow} from '@renderer/session/show/showStore';

const BAND = 30;
const HEADING = 37;
const INSET = 14;

interface Section {
  row: ServiceRow;
  tiles: readonly SlideTile[];
  top: number;
  height: number;
  number: number;
}

function makeSections(
  view: ShowView,
  {tracks, stride, rowGap}: {tracks: number; stride: number; rowGap: number},
): Section[] {
  const result: Section[] = [];
  let top = INSET;
  let number = 0;
  for (const row of view.rows) {
    const itemTiles = row.kind === 'header' ? [] : tilesForView(view, row.id);
    const height =
      (row.kind === 'header' ? HEADING : BAND) +
      (itemTiles.length
        ? Math.ceil(itemTiles.length / tracks) * stride - rowGap + INSET
        : 0);
    result.push({row, tiles: itemTiles, top, height, number});
    top += height;
    number += itemTiles.length;
  }
  return result;
}

interface Viewport {
  readonly top: number;
  readonly height: number;
  readonly stride: number;
  readonly tracks: number;
}

/** The sections that reach into the viewport, one tile row of margin each way. */
function visibleSections(
  sections: readonly Section[],
  {top, height, stride}: Viewport,
): Section[] {
  return sections.filter(
    section =>
      section.top + section.height >= top - stride &&
      section.top <= top + height + stride,
  );
}

/** The first and the end tile row of a section drawn for the viewport. */
function drawnRows(
  section: Section,
  {top, height, stride, tracks}: Viewport,
): {first: number; last: number} {
  const first = Math.max(
    0,
    Math.floor((top - section.top - BAND) / stride) - 1,
  );
  const last = Math.min(
    Math.ceil(section.tiles.length / tracks),
    Math.ceil((top + height - section.top - BAND) / stride) + 1,
  );
  return {first, last: Math.max(first, last)};
}

/** The scroll top that puts a tile on the reading line, 40% down the view. */
function readingTop(
  tile: {readonly top: number; readonly bottom: number},
  viewport: HTMLElement,
): number {
  return Math.max(
    0,
    (tile.top + tile.bottom) / 2 - viewport.clientHeight * 0.4,
  );
}

/** Identifies the sections and tile rows rendered for a viewport position. */
function windowKey(sections: readonly Section[], viewport: Viewport): string {
  const active =
    [...sections].reverse().find(section => section.top <= viewport.top + 2)
      ?.row.id ?? sections[0]?.row.id;
  const visible = visibleSections(sections, viewport).map(section => {
    const {first, last} = drawnRows(section, viewport);
    return [section.row.id, first, last];
  });
  return JSON.stringify([active, visible]);
}

/** A service-wide, row-windowed slide surface. */
export function ContinuousSlideGrid({
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const keeper = useRef<HTMLDivElement>(null);
  const entryRef = useContext(ShowSlideEntry);
  const [menu, setMenu] = useState<TileMenu | null>(null);
  const initialized = useRef(false);
  const slide = useLive(view => view.state?.layers.slide ?? null);
  const view = useShow();
  const projected = projectedLiveCursor(view, slide);
  const cursorItem = projected?.itemId;
  const cursorIndex = projected?.index;
  const progress = useSlideTransitionProgress();
  const {width, gap} = useGridMeasure(keeper, '[data-continuous-measure]');
  const tileWidth = thumbnailWidth({
    gridWidth: width,
    columns,
    gap,
    scalePercent,
  });
  const tracks =
    tileWidth > 0
      ? Math.max(1, Math.floor((width + gap) / (tileWidth + gap)))
      : columns;
  const windowKeyRef = useRef<
    ((top: number, height: number) => string) | undefined
  >(undefined);
  const {metrics, control: scrolling} = useContinuousViewport(
    keeper,
    windowKeyRef,
  );
  const followRef = useRef<
    (behavior?: ScrollBehavior, keyed?: 'down' | 'other') => void
  >(() => undefined);
  const followed = useRef<{
    item: string | undefined;
    index: number | undefined;
  } | null>(null);
  // NOTE(0913vision): Coming back to 진행 positions the grid again, also when
  // it stayed built while another workspace showed.
  useLayoutEffect(
    () => () => {
      followed.current = null;
    },
    [],
  );
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + metrics.band + metrics.rowGap : 1;
  const sections = useMemo(
    () => makeSections(view, {tracks, stride, rowGap: metrics.rowGap}),
    [view, tracks, stride, metrics.rowGap],
  );
  useReflow(keeper, {
    ids: sections.flatMap(section => [
      `heading:${section.row.id}`,
      ...tileReflowIds(section.tiles, section.row.id),
    ]),
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: 'continuous-service',
  });
  useLayoutEffect(() => {
    windowKeyRef.current = (top, height) =>
      windowKey(sections, {top, height, stride, tracks});
  }, [sections, stride, tracks]);
  const liveTile = useMemo(() => {
    const section = sections.find(value => value.row.id === cursorItem);
    if (!section || cursorIndex === undefined || stride <= 1) return null;
    const top = section.top + BAND + Math.floor(cursorIndex / tracks) * stride;
    return {top, bottom: top + stride - metrics.rowGap};
  }, [sections, cursorItem, cursorIndex, stride, tracks, metrics.rowGap]);
  const last = sections.at(-1);
  const total =
    (last?.top ?? INSET) + Math.max(last?.height ?? 0, metrics.height) + INSET;
  useLayoutEffect(() => {
    // NOTE(0913vision): The grid moves only when the live slide leaves the
    // view, or when a key moves it further down past the reading line; a
    // click or a scroll leaves the grid where the user put it.
    followRef.current = (behavior = 'smooth', keyed) => {
      const viewport = keeper.current?.parentElement;
      if (
        !viewport ||
        liveTile === null ||
        scrolling.dragging() ||
        (keyed === undefined && scrolling.paused())
      ) {
        return;
      }
      const center = (liveTile.top + liveTile.bottom) / 2;
      const offscreen =
        liveTile.top < viewport.scrollTop ||
        liveTile.bottom > viewport.scrollTop + viewport.clientHeight;
      const pastLine =
        keyed === 'down' &&
        center - viewport.scrollTop > viewport.clientHeight * 0.55;
      if (offscreen || pastLine) {
        viewport.scrollTo({top: readingTop(liveTile, viewport), behavior});
      }
    };
    // NOTE(0913vision): Only a new live tile scrolls smoothly. On entering
    // 진행 and after a size change, the grid is in place before its first
    // frame, without visible scrolling.
    const last = followed.current;
    followed.current = {item: cursorItem, index: cursorIndex};
    const moved =
      last !== null && (last.item !== cursorItem || last.index !== cursorIndex);
    const order = (item: string | undefined): number =>
      sections.findIndex(value => value.row.id === item);
    const down =
      last !== null &&
      (order(cursorItem) > order(last.item) ||
        (cursorItem === last.item &&
          (cursorIndex ?? 0) > (last.index ?? Number.MAX_SAFE_INTEGER)));
    const byKey = moved && scrolling.keyedWithin(1000);
    followRef.current(
      moved ? 'smooth' : 'instant',
      byKey ? (down ? 'down' : 'other') : undefined,
    );
  }, [cursorItem, cursorIndex, sections, liveTile, scrolling]);
  useLayoutEffect(() => {
    if (initialized.current || tileWidth <= 0 || sections.length === 0) return;
    initialized.current = true;
    const section = sections.find(
      value => value.row.id === useShow.getState().openItemId,
    );
    if (section && keeper.current?.parentElement) {
      keeper.current.parentElement.scrollTop = section.top;
    }
  }, [sections, tileWidth]);
  useEffect(() => {
    if (!entryRef) return;
    entryRef.current = () => {
      followRef.current();
      keeper.current
        ?.querySelector<HTMLElement>('[role="listbox"]')
        ?.focus({preventScroll: true});
    };
    return () => {
      entryRef.current = null;
    };
  }, [entryRef]);
  useEffect(() => {
    const select = (event: Event): void => {
      const section = sections.find(
        value => event instanceof CustomEvent && value.row.id === event.detail,
      );
      if (!section) return;
      scrolling.pause();
      keeper.current?.parentElement?.scrollTo({
        top: section.top,
        behavior: 'smooth',
      });
    };
    window.addEventListener('show-grid-item', select);
    return () => window.removeEventListener('show-grid-item', select);
  }, [sections, scrolling]);
  useEffect(() => {
    const index = Math.max(
      0,
      sections.findLastIndex(value => value.top <= metrics.top + 2),
    );
    const section =
      sections.slice(index).find(value => value.row.kind !== 'header') ??
      [...sections.slice(0, index)]
        .reverse()
        .find(value => value.row.kind !== 'header');
    if (section && initialized.current) {
      revealSlideItem(section.row.id);
    }
  }, [sections, metrics.top]);
  useEffect(() => () => revealSlideItem(null), []);
  // NOTE(0913vision): The view stays where the user scrolled; 현 위치로 in the
  // footer brings the live slide back to the reading line.
  useEffect(() => {
    liveReturn.offer(() => {
      const viewport = keeper.current?.parentElement;
      if (!viewport || liveTile === null) return;
      scrolling.resume();
      viewport.scrollTo({
        top: readingTop(liveTile, viewport),
        behavior: 'smooth',
      });
    });
  }, [liveTile, scrolling]);
  useEffect(() => () => liveReturn.offer(null), []);
  useEffect(() => {
    liveReturn.report(
      liveTile !== null &&
        (liveTile.top < metrics.top ||
          liveTile.bottom > metrics.top + metrics.height),
    );
  }, [liveTile, metrics.top, metrics.height]);
  const drawn = {top: metrics.top, height: metrics.height, stride, tracks};
  return (
    <div
      ref={keeper}
      className={styles.keeper}
      data-show-slide-grid="true"
      data-slide-window-size={firstSlideWindowSize(
        tracks,
        metrics.height,
        stride,
      )}
      style={{height: total}}
    >
      <div
        className={`${styles.measureGrid} ${styles.grid}`}
        data-continuous-measure
      />
      {visibleSections(sections, drawn).map(section => {
        const {first, last} = drawnRows(section, drawn);
        const start = first * tracks;
        const end = Math.min(section.tiles.length, last * tracks);
        return (
          <div
            key={section.row.id}
            className={styles.continuousSection}
            style={{top: section.top, height: section.height}}
          >
            {section.row.kind === 'header' ? (
              <div
                data-reflow-id={`heading:${section.row.id}`}
                role="heading"
                aria-level={3}
                className={styles.continuousHeading}
              >
                {section.row.title}
              </div>
            ) : (
              <div
                data-reflow-id={`heading:${section.row.id}`}
                className={styles.continuousBand}
              >
                <span>{section.row.title}</span>
                {section.tiles.length > 0 ? (
                  <span>{section.tiles.length}</span>
                ) : null}
              </div>
            )}
            {end > start ? (
              <div
                style={{
                  position: 'absolute',
                  top: BAND + first * stride,
                  left: 0,
                  right: 0,
                }}
              >
                <ShowTiles
                  itemId={section.row.id}
                  tiles={section.tiles}
                  start={start}
                  end={end}
                  numberOffset={section.number}
                  columns={columns}
                  tileWidth={tileWidth}
                  live={
                    cursorItem === section.row.id ? (cursorIndex ?? null) : null
                  }
                  progress={progress}
                  onMenu={setMenu}
                  className={styles.continuousTiles}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {menu !== null ? (
        <ShowTileMenu
          menu={menu}
          onOpenPrep={onOpenPrep}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
