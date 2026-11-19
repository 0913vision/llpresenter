import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import {type ServiceRow, type SlideTile} from '@core/presentation/model';
import {flushSync} from 'react-dom';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {useLive} from '@renderer/session/live';
import {outputTile, useShow} from '@renderer/session/show';
import {projectedLiveCursor, tilesForView} from '@renderer/session/showLibrary';
import type {ShowView} from '@renderer/session/showStore';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import {useBibleProjections} from '../bible/useBibleProjections';
import {splitSourceFor} from '../bible/splitProjection';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import {revealSlideItem} from '@renderer/session/visibleSlideItem';
import {liveReturn} from './liveReturn';
import type {SlideGridProps} from './SlideGrid';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {ShowSlideEntry} from './showPanelNavigation';
import {serviceTileThemes, tilePicture, type TileThemes} from './tilePicture';
import styles from './SlideGrid.module.css';

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

/** Identifies the sections and tile rows rendered for a viewport position. */
function windowKey(
  sections: readonly Section[],
  {
    top,
    height,
    stride,
    tracks,
  }: {top: number; height: number; stride: number; tracks: number},
): string {
  const active =
    [...sections].reverse().find(section => section.top <= top + 2)?.row.id ??
    sections[0]?.row.id;
  const visible = sections
    .filter(
      section =>
        section.top + section.height >= top - stride &&
        section.top <= top + height + stride,
    )
    .map(section => {
      const first = Math.max(
        0,
        Math.floor((top - section.top - BAND) / stride) - 1,
      );
      const last = Math.min(
        Math.ceil(section.tiles.length / tracks),
        Math.ceil((top + height - section.top - BAND) / stride) + 1,
      );
      return [section.row.id, first, Math.max(first, last)];
    });
  return JSON.stringify([active, visible]);
}

function SectionGrid({
  section,
  start,
  end,
  columns,
  tileWidth,
  live,
  progress,
  onMenu,
  themes,
}: {
  section: Section;
  start: number;
  end: number;
  columns: number;
  tileWidth: number;
  live: number | null;
  progress: number | undefined;
  onMenu: (index: number, anchor: MenuAnchor) => void;
  themes: TileThemes;
}): JSX.Element {
  const {row, tiles} = section;
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
      onOutput={index => outputTile({itemId: row.id, index: start + index})}
      onMenu={(index, anchor) => onMenu(start + index, anchor)}
      className={styles.continuousTiles}
    >
      {tiles.slice(start, end).map((tile, local) => {
        const index = start + local;
        const picture = tile.media?.mediaId;
        const slide = slideLayerOf({itemId: row.id, index}, () => tiles);
        return (
          <SlideThumbnail
            key={`${row.id}:${index}`}
            selectionStyle="plate"
            number={section.number + index + 1}
            canvas={tilePicture(tile, slide, themes)}
            label={tile.label === '' ? undefined : (tile.label ?? undefined)}
            labelColor={tile.labelColor}
            accessibleLabel={
              picture === undefined || tile.label
                ? undefined
                : tile.lines.join(' ')
            }
            text={picture === undefined ? tile.lines.join('\n') : undefined}
            media={picture === undefined ? undefined : thumbnailSrc(picture)}
            live={index === live}
            transitionProgress={index === live ? progress : undefined}
            hotKey={tile.hotKey}
          />
        );
      })}
    </ThumbnailGrid>
  );
}

/** A service-wide, row-windowed slide surface. */
export function ContinuousSlideGrid({
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const keeper = useRef<HTMLDivElement>(null);
  const entryRef = useContext(ShowSlideEntry);
  const [menu, setMenu] = useState<{
    itemId: string;
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const initialized = useRef(false);
  const slide = useLive(view => view.state?.layers.slide ?? null);
  const view = useShow();
  const {themes, screens, projections} = useBibleProjections({
    enabled: view.rows.length > 0,
  });
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
  const [metrics, setMetrics] = useState({
    height: 0,
    top: 0,
    band: 0,
    rowGap: 0,
  });
  const metricsRef = useRef(metrics);
  const pause = useRef(0);
  const windowKeyRef = useRef<
    ((top: number, height: number) => string) | undefined
  >(undefined);
  const dragging = useRef(false);
  const followRef = useRef<
    (behavior?: ScrollBehavior, keyed?: 'down' | 'other') => void
  >(() => undefined);
  const keyed = useRef(0);
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
  useLayoutEffect(() => {
    const viewport = keeper.current?.parentElement;
    const grid = keeper.current?.querySelector<HTMLElement>(
      '[data-continuous-measure]',
    );
    if (!viewport || !grid) return;
    const read = (): void => {
      const css = getComputedStyle(grid);
      const px = (name: string): number =>
        parseFloat(css.getPropertyValue(name)) || 0;
      const next = {
        height: viewport.clientHeight,
        top: viewport.scrollTop,
        band: px('--size-control-xs') + px('--space-6'),
        rowGap: px('row-gap'),
      };
      const old = metricsRef.current;
      if (
        old.height === next.height &&
        old.top === next.top &&
        old.band === next.band &&
        old.rowGap === next.rowGap
      ) {
        return;
      }
      metricsRef.current = next;
      setMetrics(next);
    };
    const scroll = (): void => {
      const old = metricsRef.current;
      const top = viewport.scrollTop;
      const key = windowKeyRef.current;
      if (
        top === old.top ||
        (key !== undefined && key(old.top, old.height) === key(top, old.height))
      ) {
        return;
      }
      const next = {...old, top};
      metricsRef.current = next;
      setMetrics(next);
    };
    // NOTE(0913vision): Where the user scrolls, the grid stays; it follows
    // the live slide again only when the live slide changes.
    const defer = (): void => {
      pause.current = Date.now() + 1500;
    };
    const down = (event: PointerEvent): void => {
      if (event.target === viewport || event.pointerType === 'touch') {
        dragging.current = true;
        defer();
      }
    };
    const move = (): void => {
      if (dragging.current) defer();
    };
    const up = (): void => {
      if (dragging.current) {
        dragging.current = false;
        defer();
      }
    };
    // NOTE(0913vision): A resize renders in its own frame, before it paints.
    const observer = new ResizeObserver(() => flushSync(read));
    observer.observe(viewport);
    observer.observe(grid);
    viewport.addEventListener('scroll', scroll, {passive: true});
    viewport.addEventListener('wheel', defer, {passive: true});
    // NOTE(0913vision): Only a key press counts as keyboard navigation; any
    // pointer press after it (a Shift+click, say) is a click again.
    const key = (event: KeyboardEvent): void => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        keyed.current = Date.now();
      }
    };
    const pointer = (): void => {
      keyed.current = 0;
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', pointer, true);
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    read();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', scroll);
      viewport.removeEventListener('wheel', defer);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', pointer, true);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + metrics.band + metrics.rowGap : 1;
  const sections = useMemo(
    () => makeSections(view, {tracks, stride, rowGap: metrics.rowGap}),
    [view, tracks, stride, metrics.rowGap],
  );
  useLayoutEffect(() => {
    windowKeyRef.current = (top, height) =>
      windowKey(sections, {top, height, stride, tracks});
  }, [sections, stride, tracks]);
  const last = sections.at(-1);
  const total =
    (last?.top ?? INSET) + Math.max(last?.height ?? 0, metrics.height) + INSET;
  useLayoutEffect(() => {
    // NOTE(0913vision): The grid moves only when the live slide leaves the
    // view, or when a key moves it further down past the reading line; a
    // click or a scroll leaves the grid where the user put it.
    followRef.current = (behavior = 'smooth', keyed) => {
      const viewport = keeper.current?.parentElement;
      const section = sections.find(value => value.row.id === cursorItem);
      if (
        !viewport ||
        !section ||
        cursorIndex === undefined ||
        dragging.current ||
        (keyed === undefined && Date.now() < pause.current) ||
        stride <= 1
      ) {
        return;
      }
      const top =
        section.top + BAND + Math.floor(cursorIndex / tracks) * stride;
      const bottom = top + stride - metrics.rowGap;
      const center = (top + bottom) / 2;
      const offscreen =
        top < viewport.scrollTop ||
        bottom > viewport.scrollTop + viewport.clientHeight;
      const pastLine =
        keyed === 'down' &&
        center - viewport.scrollTop > viewport.clientHeight * 0.55;
      if (offscreen || pastLine) {
        viewport.scrollTo({
          top: Math.max(0, center - viewport.clientHeight * 0.4),
          behavior,
        });
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
    const byKey = moved && Date.now() - keyed.current < 1000;
    followRef.current(
      moved ? 'smooth' : 'instant',
      byKey ? (down ? 'down' : 'other') : undefined,
    );
  }, [cursorItem, cursorIndex, sections, stride, tracks, metrics.rowGap]);
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
      pause.current = Date.now() + 1500;
      keeper.current?.parentElement?.scrollTo({
        top: section.top,
        behavior: 'smooth',
      });
    };
    window.addEventListener('show-grid-item', select);
    return () => window.removeEventListener('show-grid-item', select);
  }, [sections]);
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
  const liveTile = useMemo(() => {
    const section = sections.find(value => value.row.id === cursorItem);
    if (!section || cursorIndex === undefined || stride <= 1) return null;
    const top = section.top + BAND + Math.floor(cursorIndex / tracks) * stride;
    return {top, bottom: top + stride - metrics.rowGap};
  }, [sections, cursorItem, cursorIndex, stride, tracks, metrics.rowGap]);
  useEffect(() => {
    liveReturn.offer(() => {
      const viewport = keeper.current?.parentElement;
      if (!viewport || liveTile === null) return;
      pause.current = 0;
      viewport.scrollTo({
        top: Math.max(
          0,
          (liveTile.top + liveTile.bottom) / 2 - viewport.clientHeight * 0.4,
        ),
        behavior: 'smooth',
      });
    });
  }, [liveTile]);
  useEffect(() => () => liveReturn.offer(null), []);
  useEffect(() => {
    liveReturn.report(
      liveTile !== null &&
        (liveTile.top < metrics.top ||
          liveTile.bottom > metrics.top + metrics.height),
    );
  }, [liveTile, metrics.top, metrics.height]);
  return (
    <div
      ref={keeper}
      className={styles.keeper}
      data-show-slide-grid="true"
      style={{height: total}}
    >
      <div
        className={`${styles.measureGrid} ${styles.grid}`}
        data-continuous-measure
      />
      {sections
        .filter(
          section =>
            section.top + section.height >= metrics.top - stride &&
            section.top <= metrics.top + metrics.height + stride,
        )
        .map(section => {
          const source = splitSourceFor(view, section.row.id);
          const bible = source === null ? null : projections?.get(source);
          const first = Math.max(
            0,
            Math.floor((metrics.top - section.top - BAND) / stride) - 1,
          );
          const last = Math.min(
            Math.ceil(section.tiles.length / tracks),
            Math.ceil(
              (metrics.top + metrics.height - section.top - BAND) / stride,
            ) + 1,
          );
          const start = first * tracks,
            end = Math.min(
              section.tiles.length,
              Math.max(first, last) * tracks,
            );
          return (
            <div
              key={section.row.id}
              className={styles.continuousSection}
              style={{top: section.top, height: section.height}}
            >
              {section.row.kind === 'header' ? (
                <div
                  role="heading"
                  aria-level={3}
                  className={styles.continuousHeading}
                >
                  {section.row.title}
                </div>
              ) : (
                <div className={styles.continuousBand}>
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
                  <SectionGrid
                    section={section}
                    start={start}
                    end={end}
                    columns={columns}
                    tileWidth={tileWidth}
                    live={
                      cursorItem === section.row.id
                        ? (cursorIndex ?? null)
                        : null
                    }
                    progress={progress}
                    themes={serviceTileThemes(section.row, section.tiles, {
                      themes: themes?.value,
                      screens: screens?.value.screens,
                      bibleAppearance: bible?.appearance,
                    })}
                    onMenu={(index, anchor) =>
                      setMenu({itemId: section.row.id, index, anchor})
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      {menu !== null ? (
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
              onSelect: () =>
                outputTile({itemId: menu.itemId, index: menu.index}),
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
