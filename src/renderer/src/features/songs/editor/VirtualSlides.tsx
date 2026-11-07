import {
  useLayoutEffect,
  useRef,
  useState,
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
import type {SongSession} from './songSession';

const OVERSCAN_ROWS = 1;
const INITIAL_ROWS = 2;
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
  if (top < node.scrollTop) node.scrollTop = top;
  else if (top + stride > node.scrollTop + node.clientHeight) {
    node.scrollTop = Math.max(0, top + stride - node.clientHeight);
  }
  return node.scrollTop;
}
interface WindowStyle extends CSSProperties {
  readonly '--grid-top': string;
}

/** Slides that belong to no song, such as a Bible passage's. */
interface SlideSource {
  readonly slides: ReadonlyArray<{
    readonly label?: string;
    readonly lines: readonly string[];
  }>;
}

/** Windows by rows; the full logical list remains reachable by keyboard. */
export function VirtualSlides({
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
  readonly session?: SongSession;
  readonly decoration?: ((start: number) => ReactNode) | undefined;
}): JSX.Element {
  const theme = useSlideTheme(
    {id: 'thumbnail', kind: 'song', title: ''},
    'external',
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
        xGap: px('--space-12'),
        yGap: px('--space-16'),
        band: px('--size-thumb-band'),
        inset: px('padding-top'),
      });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    read();
    return () => observer.disconnect();
  }, []);
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
  }, [selected, columns, stride, measure.inset]);
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
        const slide = session.history.snapshot.song.slides[index];
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
        const slide = session.history.snapshot.song.slides[start + local];
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
            if (number !== undefined) setMenu({index: at, number, anchor});
          }}
          className={styles.grid}
        >
          {numbers.slice(start, end).map((number, index) => {
            const slides = song.slides;
            const slide = slides[number - 1];
            if (slide === undefined) return null;
            const own = session?.history.snapshot.song.slides[number - 1];
            const thumbnail = (
              <SlideThumbnail
                key={start + index}
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
                      background={session?.background}
                      slide={{
                        itemId: 'thumbnail',
                        position: number - 1,
                        label: slide.label ?? null,
                        lines: slide.lines,
                      }}
                    />
                  ))
                }
                selected={
                  session === undefined
                    ? start + index === selected
                    : own !== undefined &&
                      session.history.model
                        .getSnapshot()
                        .selection.ids.has(own.id)
                }
                hotKey={'hotKey' in slide ? slide.hotKey : undefined}
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
                  className={styles.gridGap}
                  data-caret={
                    session.history.model.getSnapshot().selection.caret ===
                    number - 1
                  }
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
            data-caret={
              session.history.model.getSnapshot().selection.caret ===
              numbers.length
            }
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
