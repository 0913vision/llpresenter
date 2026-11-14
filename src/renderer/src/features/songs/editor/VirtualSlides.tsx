import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type {Label} from '@core/schema/labels';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui/SlideThumbnail';
import {thumbnailWidth} from '@renderer/ui/thumbnailSize';
import {isComposing} from '@renderer/ui/ime';
import type {Song} from '@core/schema/song';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import styles from './SongPanels.module.css';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {slideMenuEntries} from './slideMenuEntries';
import type {SlideListSession} from './slideListSession';
import type {SlideListItem} from '@core/songs/slideListEdits';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;
const emptySnapshot = () => undefined;
const emptySubscribe = () => emptySnapshot;
interface Measure {
  readonly width: number;
  readonly height: number;
  readonly xGap: number;
  readonly yGap: number;
  readonly band: number;
  readonly inset: number;
}
const EMPTY: Measure = {
  width: 0,
  height: 0,
  xGap: 0,
  yGap: 0,
  band: 0,
  inset: 0,
};
function reveal(
  node: HTMLElement,
  index: number,
  {
    columns,
    stride,
    inset,
  }: {
    readonly columns: number;
    readonly stride: number;
    readonly inset: number;
  },
): number {
  const top = Math.floor(index / columns) * stride + inset;
  if (top < node.scrollTop || stride + inset > node.clientHeight) {
    node.scrollTop = Math.max(0, top - inset);
  } else if (top + stride > node.scrollTop + node.clientHeight) {
    node.scrollTop = Math.max(0, top + stride - node.clientHeight);
  }
  return node.scrollTop;
}
interface WindowStyle extends CSSProperties {
  readonly '--grid-top': string;
}

/** Slides that belong to no song, such as a Bible passage's. */
interface SlideSource {
  readonly theme?: import('@core/schema/ids').ThemeId;
  readonly slides: ReadonlyArray<{
    readonly label?: string;
    readonly lines: readonly string[];
    readonly titleSlide?: true;
    readonly titleLayout?: import('@core/schema/songTitleLayout').SongTitleLayout;
    readonly lyricFormat?: import('@core/schema/songLyricFormat').SongLyricFormat;
    readonly transition?: import('@core/schema/slideTransition').SlideTransition;
  }>;
}

/** Windows by rows; the full logical list remains reachable by keyboard. */
export function VirtualSlides<T extends SlideListItem>({
  song,
  numbers,
  labels,
  selected,
  onSelect,
  baseline,
  scale,
  onEdit,
  onHotKey,
  hotKeyReason,
  canvasFor,
  session,
  decoration,
  background,
}: {
  readonly song: SlideSource | Song;
  readonly numbers: readonly number[];
  readonly labels: readonly Label[];
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
  readonly baseline: number;
  readonly scale: number;
  readonly onEdit?: ((index: number) => void) | undefined;
  readonly onHotKey?: ((index: number) => void) | undefined;
  readonly hotKeyReason?: string | undefined;
  readonly canvasFor?: ((index: number) => ReactNode) | undefined;
  readonly session?: SlideListSession<T>;
  readonly decoration?: ((start: number) => ReactNode) | undefined;
  readonly background?: string | undefined;
}): JSX.Element {
  const list = useSyncExternalStore(
    session?.slideModel.subscribe ?? emptySubscribe,
    session?.slideModel.getSnapshot ?? emptySnapshot,
  );
  const songTheme = song.theme;
  const theme = useSlideTheme(
    {
      id: 'thumbnail',
      kind: 'song',
      title: '',
      ...(songTheme === undefined ? {} : {theme: songTheme}),
    },
    songTheme === undefined ? 'external' : 'service',
  );
  const [menu, setMenu] = useState<{
    index: number;
    number: number;
    anchor: MenuAnchor;
  } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const focusNext = useRef<number | null>(null);
  const [measure, setMeasure] = useState(EMPTY);
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const read = (): void => {
      const css = getComputedStyle(node);
      const px = (name: string): number =>
        Number.parseFloat(css.getPropertyValue(name)) || 0;
      setMeasure({
        width: node.clientWidth - px('padding-left') - px('padding-right'),
        height: node.clientHeight,
        xGap: px(session === undefined ? '--space-12' : '--space-24'),
        yGap: px(session === undefined ? '--space-16' : '--space-24'),
        band:
          session === undefined
            ? px('--size-thumb-band')
            : px('--size-control-xs') + px('--space-6'),
        inset: px('padding-top'),
      });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    read();
    return () => observer.disconnect();
  }, [session]);
  const width = thumbnailWidth({
    gridWidth: measure.width,
    columns: baseline,
    gap: measure.xGap,
    scalePercent: scale,
  });
  const columns =
    width > 0
      ? Math.max(
          1,
          Math.floor((measure.width + measure.xGap) / (width + measure.xGap)),
        )
      : baseline;
  const stride = width > 0 ? (width * 9) / 16 + measure.band + measure.yGap : 1;
  const rows = Math.ceil(numbers.length / columns);
  const visible =
    measure.height > 0 ? Math.ceil(measure.height / stride) : INITIAL_ROWS;
  const firstRow = Math.max(
    0,
    Math.min(
      Math.floor(Math.max(0, scrollTop - measure.inset) / stride) -
        OVERSCAN_ROWS,
      rows - visible,
    ),
  );
  const start = firstRow * columns;
  const end = Math.min(
    numbers.length,
    (firstRow + visible + OVERSCAN_ROWS * 2) * columns,
  );
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node !== null && selected !== undefined) {
      reveal(node, selected, {columns, stride, inset: measure.inset});
    }
  }, [selected, columns, stride, measure.inset, measure.height]);
  useLayoutEffect(() => {
    const target = focusNext.current;
    if (target !== null && target >= start && target < end) {
      const options =
        viewport.current?.querySelectorAll<HTMLElement>('[role="option"]');
      options?.[target - start]?.focus({preventScroll: true});
      focusNext.current = null;
    }
  }, [start, end, selected]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (session !== undefined) {
      if (
        isComposing(event) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      const moves: Readonly<Record<string, number>> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -columns,
        ArrowDown: columns,
      };
      if (event.key === 'Home' || event.key === 'End') {
        const index = event.key === 'Home' ? 0 : numbers.length - 1;
        const slide = session.slideModel.getSnapshot().slides[index];
        if (slide === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        session.selectSlides({
          type: 'click',
          id: slide.id,
          shift: event.shiftKey,
        });
        focusNext.current = index;
        const node = viewport.current;
        if (node !== null) {
          setScrollTop(
            reveal(node, index, {columns, stride, inset: measure.inset}),
          );
        }
        return;
      }
      const delta = moves[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      session.selectSlides({type: 'arrow', delta, shift: event.shiftKey});
      focusNext.current = session.selectedOccurrence;
      const node = viewport.current;
      if (node !== null) {
        setScrollTop(
          reveal(node, session.selectedOccurrence, {
            columns,
            stride,
            inset: measure.inset,
          }),
        );
      }
      return;
    }
    if (
      isComposing(event) ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const node = viewport.current;
    const option =
      event.target instanceof Element
        ? event.target.closest('[role="option"]')
        : null;
    if (node === null || option === null) return;
    const local = [...node.querySelectorAll('[role="option"]')].indexOf(option);
    const current = start + local;
    const moves: Readonly<Record<string, number>> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current - columns,
      ArrowDown: current + columns,
      Home: 0,
      End: numbers.length - 1,
    };
    const proposed = moves[event.key];
    if (proposed === undefined || local < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = Math.max(0, Math.min(numbers.length - 1, proposed));
    focusNext.current = next;
    setScrollTop(reveal(node, next, {columns, stride, inset: measure.inset}));
    onSelect(next);
  };
  const windowStyle: WindowStyle = {
    height: Math.max(0, rows * stride - measure.yGap),
    '--grid-top': `${firstRow * stride}px`,
  };
  return (
    <div
      ref={viewport}
      data-slide-columns={columns}
      data-editor={session !== undefined || undefined}
      className={styles.viewport}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDownCapture={navigate}
      onClickCapture={event => {
        if (session === undefined || !(event.target instanceof Element)) return;
        const option = event.target.closest<HTMLElement>('[role="option"]');
        if (option === null) return;
        const local = [
          ...event.currentTarget.querySelectorAll('[role="option"]'),
        ].indexOf(option);
        const slide = session.slideModel.getSnapshot().slides[start + local];
        if (slide === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        session.selectSlides({
          type: 'click',
          id: slide.id,
          shift: event.shiftKey,
          ctrl: event.ctrlKey || event.metaKey,
        });
        option.focus({preventScroll: true});
      }}
      onDoubleClick={event => {
        if (session === undefined || !(event.target instanceof Element)) return;
        const option = event.target.closest<HTMLElement>('[role="option"]');
        if (option === null) return;
        const local = [
          ...event.currentTarget.querySelectorAll('[role="option"]'),
        ].indexOf(option);
        if (local >= 0) onEdit?.(start + local);
      }}
    >
      <div className={styles.spacer} style={windowStyle}>
        <ThumbnailGrid
          workspace="prep"
          label="슬라이드"
          columns={baseline}
          tileWidth={width}
          positionOffset={start}
          setSize={numbers.length}
          orientation="vertical"
          selected={
            selected !== undefined && selected >= start && selected < end
              ? selected - start
              : undefined
          }
          onSelect={index => onSelect(start + index)}
          onMenu={(index, anchor) => {
            if (session !== undefined) return;
            const at = start + index;
            const number = numbers[at];
            if (number !== undefined) {
              onSelect(at);
              setMenu({index: at, number, anchor});
            }
          }}
          className={styles.grid}
        >
          {numbers.slice(start, end).map((number, index) => {
            const slides = song.slides;
            const slide = slides[number - 1];
            if (slide === undefined) return null;
            const own = list?.slides[number - 1];
            const thumbnail = (
              <SlideThumbnail
                key={start + index}
                selectionStyle={session === undefined ? 'ring' : 'plate'}
                number={number}
                label={slide.label === '' ? undefined : slide.label}
                labelColor={
                  labels.find(label => label.name === slide.label)?.color ??
                  'none'
                }
                text={slide.lines.join('\n')}
                canvas={
                  canvasFor?.(number - 1) ??
                  (theme === undefined ? undefined : (
                    <SlidePicture
                      {...theme}
                      background={background}
                      slide={{
                        itemId: 'thumbnail',
                        position: number - 1,
                        label: slide.label ?? null,
                        lines: slide.lines,
                        ...(slide.titleSlide === undefined
                          ? {}
                          : {titleSlide: slide.titleSlide}),
                        ...(slide.titleLayout === undefined
                          ? {}
                          : {titleLayout: slide.titleLayout}),
                        ...(slide.lyricFormat === undefined
                          ? {}
                          : {lyricFormat: slide.lyricFormat}),
                      }}
                    />
                  ))
                }
                selected={
                  session === undefined
                    ? start + index === selected
                    : own !== undefined && list?.selection.ids.has(own.id)
                }
                hotKey={'hotKey' in slide ? slide.hotKey : undefined}
                transition={
                  own === undefined ? slide.transition : own.transition
                }
              />
            );
            if (session === undefined) return thumbnail;
            return (
              <div
                key={start + index}
                className={styles.editableTile}
                data-song-slide={own?.id}
                data-slide-index={number - 1}
                draggable={!session.readOnly}
              >
                <button
                  type="button"
                  data-slide-gap={number - 1}
                  tabIndex={-1}
                  className={styles.gridGap}
                  data-caret={list?.selection.caret === number - 1}
                  aria-label={`슬라이드 ${number} 앞에 삽입`}
                  onClick={event => {
                    session.selectSlides({type: 'gap', index: number - 1});
                    event.currentTarget
                      .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
                      ?.focus();
                  }}
                />
                {thumbnail}
              </div>
            );
          })}
        </ThumbnailGrid>
        {decoration?.(start)}
        {session === undefined ? null : (
          <button
            type="button"
            className={styles.lastGap}
            data-slide-gap={numbers.length}
            tabIndex={-1}
            data-caret={list?.selection.caret === numbers.length}
            aria-label="마지막 슬라이드 뒤에 삽입"
            onClick={event => {
              session.selectSlides({type: 'gap', index: numbers.length});
              event.currentTarget
                .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
                ?.focus();
            }}
          />
        )}
      </div>
      {menu !== null && numbers[menu.index] === menu.number ? (
        <Menu
          context
          label="슬라이드"
          anchor={menu.anchor}
          entries={slideMenuEntries(
            onEdit === undefined ? undefined : () => onEdit(menu.index),
            onHotKey === undefined
              ? undefined
              : {open: () => onHotKey(menu.index), reason: hotKeyReason},
          )}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
