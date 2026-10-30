import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {Song} from '@core/schema/song';
import type {Label} from '@core/schema/labels';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui/SlideThumbnail';
import {thumbnailWidth} from '@renderer/ui/thumbnailSize';
import {isComposing} from '@renderer/ui/ime';
import type {AnySong} from '@core/schema/groupedSong';
import {linearSlidesOf} from './blockEdits';
import styles from './SongPanels.module.css';

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

/** Windows by rows; the full logical list remains reachable by keyboard. */
export function VirtualSlides({
  song,
  numbers,
  labels,
  selected,
  onSelect,
  baseline,
  scale,
}: {
  readonly song: Pick<Song, 'slides'> | AnySong;
  readonly numbers: readonly number[];
  readonly labels: readonly Label[];
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
  readonly baseline: number;
  readonly scale: number;
}): JSX.Element {
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
      className={styles.viewport}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDownCapture={navigate}
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
          className={styles.grid}
        >
          {numbers.slice(start, end).map((number, index) => {
            const slides =
              'slides' in song ? song.slides : linearSlidesOf(song);
            const slide = slides[number - 1];
            return slide === undefined ? null : (
              <SlideThumbnail
                key={start + index}
                number={number}
                label={slide.label === '' ? undefined : slide.label}
                labelColor={
                  labels.find(label => label.name === slide.label)?.color ??
                  'none'
                }
                text={slide.lines.join('\n')}
                selected={start + index === selected}
                hotKey={'hotKey' in slide ? slide.hotKey : undefined}
              />
            );
          })}
        </ThumbnailGrid>
      </div>
    </div>
  );
}
