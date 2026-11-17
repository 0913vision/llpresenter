import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import {
  isItemRow,
  type ServiceRow,
  type SlideTile,
} from '@core/presentation/model';
import {flushSync} from 'react-dom';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {useLive} from '@renderer/session/live';
import {outputTile, useShow} from '@renderer/session/show';
import {projectedLiveCursor, tilesForView} from '@renderer/session/showLibrary';
import type {ShowView} from '@renderer/session/showStore';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {SlideThumbnail, ThumbnailGrid, thumbnailWidth} from '@renderer/ui';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';
import {useBibleTileProjection} from '../bible/useBibleProjections';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import {revealSlideItem} from '@renderer/session/visibleSlideItem';
import type {SlideGridProps} from './SlideGrid';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {ShowSlideEntry} from './showPanelNavigation';
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

function SectionGrid({
  section,
  start,
  end,
  columns,
  tileWidth,
  live,
  progress,
  onMenu,
}: {
  section: Section;
  start: number;
  end: number;
  columns: number;
  tileWidth: number;
  live: number | null;
  progress: number | undefined;
  onMenu: (index: number, anchor: MenuAnchor) => void;
}): JSX.Element {
  const {row, tiles} = section;
  const theme = useSlideTheme(isItemRow(row) ? row : undefined);
  const card = tiles.find(tile => tile.sectionCard)?.sectionCard;
  const cardTheme = useSlideTheme(
    card === undefined
      ? undefined
      : {
          id: row.id,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  const sermonTheme = useSlideTheme(
    row.kind === 'bible' &&
      row.sermonTitle !== undefined &&
      row.bible !== undefined
      ? sermonPreviewRow(row.id, row.bible.ref)
      : undefined,
  );
  const bible = useBibleTileProjection({itemId: row.id, anyItem: true});
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
        const appearance =
          tile.biblePart === undefined ? undefined : bible?.appearance;
        return (
          <SlideThumbnail
            key={`${row.id}:${index}`}
            selectionStyle="plate"
            number={section.number + index + 1}
            canvas={
              picture !== undefined ||
              slide === null ? undefined : tile.sectionCard !== undefined &&
                cardTheme !== undefined ? (
                <SlidePicture output {...cardTheme} slide={slide} />
              ) : tile.sermonTitle === true && sermonTheme !== undefined ? (
                <SlidePicture output {...sermonTheme} slide={slide} />
              ) : appearance !== undefined ? (
                <SlidePicture
                  output
                  screen={appearance.screen}
                  themeId={appearance.theme.themeId}
                  slide={slide}
                  layout={appearance.theme.layout}
                  emptyColor={appearance.theme.emptyColor}
                  item={appearance.theme.item}
                  background={appearance.background}
                />
              ) : theme === undefined ? undefined : (
                <SlidePicture output {...theme} slide={slide} />
              )
            }
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
  const pause = useRef(0);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const followRef = useRef<(behavior?: ScrollBehavior) => void>(
    () => undefined,
  );
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
      setMetrics(old =>
        old.height === next.height &&
        old.top === next.top &&
        old.band === next.band &&
        old.rowGap === next.rowGap
          ? old
          : next,
      );
    };
    const defer = (): void => {
      pause.current = Date.now() + 1500;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!dragging.current) followRef.current();
      }, 1500);
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
    viewport.addEventListener('scroll', read, {passive: true});
    viewport.addEventListener('wheel', defer, {passive: true});
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    read();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', read);
      viewport.removeEventListener('wheel', defer);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, []);
  const stride =
    tileWidth > 0 ? (tileWidth * 9) / 16 + metrics.band + metrics.rowGap : 1;
  const sections = useMemo(
    () => makeSections(view, {tracks, stride, rowGap: metrics.rowGap}),
    [view, tracks, stride, metrics.rowGap],
  );
  const last = sections.at(-1);
  const total =
    (last?.top ?? INSET) + Math.max(last?.height ?? 0, metrics.height) + INSET;
  useLayoutEffect(() => {
    followRef.current = (behavior = 'smooth') => {
      const viewport = keeper.current?.parentElement;
      const section = sections.find(value => value.row.id === cursorItem);
      if (
        !viewport ||
        !section ||
        cursorIndex === undefined ||
        dragging.current ||
        Date.now() < pause.current ||
        stride <= 1
      ) {
        return;
      }
      const center =
        section.top +
        BAND +
        Math.floor(cursorIndex / tracks) * stride +
        (stride - metrics.rowGap) / 2;
      const relative = center - viewport.scrollTop;
      if (
        relative < viewport.clientHeight * 0.3 ||
        relative > viewport.clientHeight * 0.55
      ) {
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
    followRef.current(moved ? 'smooth' : 'instant');
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
    const section =
      [...sections].reverse().find(value => value.top <= metrics.top + 2) ??
      sections[0];
    if (section && initialized.current) {
      revealSlideItem(section.row.id);
    }
  }, [sections, metrics.top]);
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
