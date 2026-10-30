import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEventHandler,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {MediaGrid} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import type {MenuAnchor} from '@renderer/ui/Menu';
import styles from './MediaView.module.css';

/** The rows mounted beyond the visible ones, above and below. */
export const OVERSCAN_ROWS = 1;

/** The rows mounted before the viewport has been measured. */
export const INITIAL_ROWS = 3;

const NAME_LINE_PX = 16;
const OPTION = '[role="option"]';

interface Measure {
  readonly width: number;
  readonly height: number;
  readonly xGap: number;
  readonly yGap: number;
  readonly nameGap: number;
  readonly inset: number;
}

const UNMEASURED: Measure = {
  width: 0,
  height: 0,
  xGap: 0,
  yGap: 0,
  nameGap: 0,
  inset: 0,
};

interface WindowStyle extends CSSProperties {
  readonly '--grid-top': string;
}

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

function useMeasure(viewport: RefObject<HTMLDivElement | null>): Measure {
  const [measure, setMeasure] = useState(UNMEASURED);
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
        nameGap: px('--space-8'),
        inset: px('padding-top'),
      });
    };
    const observer = new ResizeObserver(read);
    observer.observe(node);
    read();
    return () => observer.disconnect();
  }, [viewport]);
  return measure;
}

export interface VirtualMediaGridProps {
  readonly workspace?: 'show' | 'prep';
  /** The list name for assistive technology, such as 모든 미디어. */
  readonly label: string;
  readonly count: number;
  readonly columns: number;
  readonly selected: number | undefined;
  /** Read-only grids move focus without changing selection. */
  readonly arrowsMove?: 'selection' | 'focus';
  readonly onSelect: (index: number) => void;
  readonly onActivate: (index: number) => void;
  readonly onOutput: (index: number) => void;
  readonly onMenu: (index: number, anchor: MenuAnchor) => void;
  /** The tile at an index of the whole list. */
  readonly tile: (index: number) => ReactNode;
  readonly onDragOver?: DragEventHandler<HTMLDivElement>;
  readonly onDrop?: DragEventHandler<HTMLDivElement>;
}

/**
 * The media grid, mounting only the rows in view and {@link OVERSCAN_ROWS}
 * on each side, so a long list costs a few rows of tiles and thumbnails. The
 * arrow keys, Home, and End still reach every tile, scrolling it into view.
 */
export function VirtualMediaGrid({
  label,
  count,
  columns,
  selected,
  arrowsMove = 'selection',
  onSelect,
  onActivate,
  onOutput,
  onMenu,
  tile,
  onDragOver,
  onDrop,
  workspace = 'prep',
}: VirtualMediaGridProps): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const focusNext = useRef<number | null>(null);
  const measure = useMeasure(viewport);
  const [scrollTop, setScrollTop] = useState(0);
  const tileWidth =
    measure.width > 0
      ? (measure.width - (columns - 1) * measure.xGap) / columns
      : 0;
  const stride =
    tileWidth > 0
      ? (tileWidth * 9) / 16 + measure.nameGap + NAME_LINE_PX + measure.yGap
      : 1;
  const rows = Math.ceil(count / columns);
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
    count,
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
    if (target === null || target < start || target >= end) return;
    const options = viewport.current?.querySelectorAll<HTMLElement>(OPTION);
    options?.[target - start]?.focus({preventScroll: true});
    focusNext.current = null;
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
        ? event.target.closest<HTMLElement>(OPTION)
        : null;
    if (node === null || option === null) return;
    const options = [...node.querySelectorAll<HTMLElement>(OPTION)];
    const local = options.indexOf(option);
    const current = start + local;
    const moves: Readonly<Record<string, number>> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current - columns,
      ArrowDown: current + columns,
      Home: 0,
      End: count - 1,
    };
    const proposed = moves[event.key];
    if (proposed === undefined || local < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = Math.max(0, Math.min(count - 1, proposed));
    const target = options[next - start];
    focusNext.current = target === undefined ? next : null;
    setScrollTop(reveal(node, next, {columns, stride, inset: measure.inset}));
    target?.focus({preventScroll: true});
    if (arrowsMove === 'selection') onSelect(next);
  };
  const windowStyle: WindowStyle = {
    height: Math.max(0, rows * stride - measure.yGap),
    '--grid-top': `${firstRow * stride}px`,
  };
  const local = (index: number): number => start + index;
  return (
    <div
      ref={viewport}
      className={styles.viewport}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDownCapture={navigate}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles.spacer} style={windowStyle}>
        <MediaGrid
          workspace={workspace}
          arrowsMove={arrowsMove}
          label={label}
          columns={columns}
          positionOffset={start}
          setSize={count}
          selected={
            selected !== undefined && selected >= start && selected < end
              ? selected - start
              : undefined
          }
          onSelect={index => onSelect(local(index))}
          onActivate={index => onActivate(local(index))}
          onOutput={index => onOutput(local(index))}
          onMenu={(index, anchor) => onMenu(local(index), anchor)}
          className={styles.window}
        >
          {Array.from({length: Math.max(0, end - start)}, (_, index) =>
            tile(local(index)),
          )}
        </MediaGrid>
      </div>
    </div>
  );
}
