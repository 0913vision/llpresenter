import {useEffect, useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {
  ItemRow,
  ServiceRow,
  SlideTile,
  TileCursor,
} from '@core/presentation/model';
import {isItemRow} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {liveCursor, outputTile, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {tilesForView} from '@renderer/session/showLibrary';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {
  Icon,
  SlideThumbnail,
  ThumbnailGrid,
  thumbnailWidth,
} from '@renderer/ui';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {useBibleProjections} from '../bible/useBibleProjections';
import {splitSourceFor, type BibleProjections} from '../bible/splitProjection';
import type {ShowView} from '@renderer/session/showStore';
import type {SlideGridProps} from './SlideGrid';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import styles from './ContinuousSlideGrid.module.css';

const GAP = 16;
const ICON: Readonly<Record<ServiceRow['kind'], string>> = {
  header: 'bookmark',
  song: 'song',
  bible: 'book',
  slides: 'slides',
  media: 'film',
  unknown: 'filetext',
};

interface Group {
  readonly row: ServiceRow;
  readonly tiles: readonly SlideTile[];
  readonly offset: number;
}

export function continuousGroups(view: ShowView): Group[] {
  let offset = 0;
  return view.rows.map(row => {
    const tiles = isItemRow(row) ? tilesForView(view, row.id) : [];
    const group = {row, tiles, offset};
    offset += tiles.length;
    return group;
  });
}

/** Draft-only service-wide slide list, keeping the ordinary output commands. */
export function ContinuousSlideGrid({
  columns,
  scalePercent,
  onOpenPrep,
}: SlideGridProps): JSX.Element {
  const view = useShow();
  useLive(state => state.state);
  const live = liveCursor();
  const transitionProgress = useSlideTransitionProgress();
  const root = useRef<HTMLDivElement>(null);
  const clickedTile = useRef(false);
  const [menu, setMenu] = useState<{
    itemId: string;
    index: number;
    anchor: MenuAnchor;
  } | null>(null);
  const [width, setWidth] = useState(0);
  const {projections, refinementRevision} = useBibleProjections();
  useLayoutEffect(() => {
    const node = root.current;
    if (node === null) return;
    const read = (): void => setWidth(node.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (clickedTile.current) {
      clickedTile.current = false;
      return;
    }
    if (view.openItemId === null) return;
    const section = [
      ...(root.current?.querySelectorAll<HTMLElement>(
        '[data-continuous-item]',
      ) ?? []),
    ].find(node => node.dataset['continuousItem'] === view.openItemId);
    section?.scrollIntoView({block: 'start', behavior: 'smooth'});
  }, [view.openItemId]);
  useEffect(() => {
    const click = (event: MouseEvent): void => {
      const row =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-order-id]')
          : null;
      const itemId = row?.dataset['orderId'];
      if (itemId === undefined) return;
      const section = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          '[data-continuous-item]',
        ) ?? []),
      ].find(node => node.dataset['continuousItem'] === itemId);
      section?.scrollIntoView({block: 'start', behavior: 'smooth'});
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  const groups = continuousGroups(view);
  const gridWidth = Math.max(0, width - 32);
  const tileWidth = thumbnailWidth({
    gridWidth,
    columns,
    gap: GAP,
    scalePercent,
  });
  const tracks =
    tileWidth > 0
      ? Math.max(1, Math.floor((gridWidth + GAP) / (tileWidth + GAP)))
      : columns;
  return (
    <div
      ref={root}
      className={styles.list}
      data-show-slide-grid="true"
      data-continuous-grid="true"
    >
      {groups.map(group => (
        <ContinuousSection
          key={group.row.id}
          group={group}
          view={view}
          live={live}
          transitionProgress={transitionProgress}
          columns={columns}
          tileWidth={tileWidth}
          tracks={tracks}
          projections={projections}
          refinementRevision={refinementRevision}
          onOutput={index => {
            clickedTile.current = view.openItemId !== group.row.id;
            outputTile({itemId: group.row.id, index});
            setTimeout(() => {
              clickedTile.current = false;
            }, 0);
          }}
          onMenu={(index, anchor) =>
            setMenu({itemId: group.row.id, index, anchor})
          }
        />
      ))}
      {menu !== null && view.rows.some(row => row.id === menu.itemId) ? (
        <Menu
          context
          label="슬라이드"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
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
        />
      ) : null}
    </div>
  );
}

function ContinuousSection({
  group,
  view,
  live,
  transitionProgress,
  columns,
  tileWidth,
  tracks,
  projections,
  refinementRevision,
  onOutput,
  onMenu,
}: {
  readonly group: Group;
  readonly view: ShowView;
  readonly live: TileCursor | null;
  readonly transitionProgress: number | undefined;
  readonly columns: number;
  readonly tileWidth: number;
  readonly tracks: number;
  readonly projections: BibleProjections | null;
  readonly refinementRevision: number;
  readonly onOutput: (index: number) => void;
  readonly onMenu: (index: number, anchor: MenuAnchor) => void;
}): JSX.Element {
  const node = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || node.current === null) {
      return;
    }
    const observer = new IntersectionObserver(
      entries => setVisible(entries.some(entry => entry.isIntersecting)),
      {rootMargin: '700px'},
    );
    observer.observe(node.current);
    return () => observer.disconnect();
  }, []);
  const {row, tiles} = group;
  const source = splitSourceFor(view, row.id);
  const estimate =
    Math.ceil(tiles.length / tracks) * (((tileWidth || 180) * 9) / 16 + 46) +
    16;
  return (
    <section
      ref={node}
      data-continuous-item={row.id}
      className={styles.section}
    >
      <div
        className={row.kind === 'header' ? styles.divider : styles.header}
        data-current={view.openItemId === row.id || undefined}
      >
        <Icon name={ICON[row.kind]} size={16} />
        <span className={styles.title}>{row.title || '이름 없는 항목'}</span>
        {isItemRow(row) ? (
          <span className={styles.count}>{tiles.length}장</span>
        ) : null}
      </div>
      {isItemRow(row) && tiles.length > 0 ? (
        visible ? (
          <SectionTiles
            row={row}
            tiles={tiles}
            offset={group.offset}
            columns={columns}
            tileWidth={tileWidth}
            live={live}
            transitionProgress={transitionProgress}
            selected={
              view.openItemId === row.id ? view.selectedTile : undefined
            }
            projection={
              source === null
                ? null
                : (projections?.get(source, refinementRevision) ?? null)
            }
            onOutput={onOutput}
            onMenu={onMenu}
          />
        ) : (
          <div aria-hidden="true" style={{height: estimate}} />
        )
      ) : null}
    </section>
  );
}

function SectionTiles({
  row,
  tiles,
  offset,
  columns,
  tileWidth,
  live,
  transitionProgress,
  selected,
  projection,
  onOutput,
  onMenu,
}: {
  readonly row: ItemRow;
  readonly tiles: readonly SlideTile[];
  readonly offset: number;
  readonly columns: number;
  readonly tileWidth: number;
  readonly live: TileCursor | null;
  readonly transitionProgress: number | undefined;
  readonly selected: number | undefined;
  readonly projection: ReturnType<BibleProjections['get']>;
  readonly onOutput: (index: number) => void;
  readonly onMenu: (index: number, anchor: MenuAnchor) => void;
}): JSX.Element {
  const theme = useSlideTheme(row);
  const card = tiles.find(tile => tile.sectionCard !== undefined)?.sectionCard;
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
  return (
    <ThumbnailGrid
      workspace="show"
      gridFocus
      label="슬라이드"
      columns={columns}
      tileWidth={tileWidth}
      selected={selected}
      onSelect={() => undefined}
      onOutput={onOutput}
      onMenu={onMenu}
      className={styles.grid}
    >
      {tiles.map((tile, index) => {
        const slide = slideLayerOf({itemId: row.id, index}, () => tiles);
        const picture = tile.media?.mediaId;
        const appearance =
          tile.biblePart === undefined ? undefined : projection?.appearance;
        const canvas =
          slide === null ||
          picture !== undefined ? undefined : tile.sectionCard !== undefined &&
            cardTheme !== undefined ? (
            <SlidePicture output {...cardTheme} slide={slide} />
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
          );
        return (
          <SlideThumbnail
            key={index}
            selectionStyle="plate"
            number={offset + index + 1}
            canvas={canvas}
            label={tile.label === '' ? undefined : (tile.label ?? undefined)}
            labelColor={tile.labelColor}
            text={picture === undefined ? tile.lines.join('\n') : undefined}
            media={picture === undefined ? undefined : thumbnailSrc(picture)}
            live={live?.itemId === row.id && live.index === index}
            transitionProgress={
              live?.itemId === row.id && live.index === index
                ? transitionProgress
                : undefined
            }
            selected={selected === index}
            hotKey={tile.hotKey}
          />
        );
      })}
    </ThumbnailGrid>
  );
}
