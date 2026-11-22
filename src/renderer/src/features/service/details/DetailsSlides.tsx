import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import type {LabelColor} from '@core/labels';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui/SlideThumbnail';
import {detailsGridGeometry} from './detailsGridGeometry';
import styles from './DetailsSlides.module.css';
import {scrollParent} from '@renderer/ui/scrollParent';
import {useReflow} from '@renderer/ui/useReflow';

const COLUMNS = 2;
const INITIAL_COUNT = 8;
const OVERSCAN = 2;
interface Range {
  readonly start: number;
  readonly end: number;
  readonly stride: number;
  readonly columns: number;
  readonly tileWidth: number;
}

function reveal(viewport: HTMLElement, top: number, stride: number): void {
  if (top < viewport.scrollTop) viewport.scrollTop = top;
  else if (top + stride > viewport.scrollTop + viewport.clientHeight) {
    viewport.scrollTop = top + stride - viewport.clientHeight;
  }
}

/** Windows the grid against the panel's own scroll, so pictures outside it are not drawn. */
export function DetailsSlides({
  count,
  scale = 100,
  selected,
  onSelect,
  onEdit,
  labelAt,
  colorAt,
  picture,
  ids,
  scope,
}: {
  readonly count: number;
  readonly scale?: number | undefined;
  readonly selected: number;
  readonly onSelect: (index: number) => void;
  readonly onEdit: (index: number) => void;
  readonly labelAt: (index: number) => string | undefined;
  readonly colorAt: (index: number) => LabelColor;
  readonly picture: (index: number) => ReactNode;
  readonly ids?: readonly string[] | undefined;
  readonly scope?: string | undefined;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const reflowIds =
    ids ?? Array.from({length: count}, (_, index) => String(index));
  useReflow(host, {
    ids: reflowIds,
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: scope ?? 'details',
  });
  const pendingFocus = useRef<number | null>(null);
  const [range, setRange] = useState<Range>({
    start: 0,
    end: Math.min(count, INITIAL_COUNT),
    stride: 0,
    columns: COLUMNS,
    tileWidth: detailsGridGeometry(0, 0, scale).tileWidth,
  });
  useLayoutEffect(() => {
    const element = host.current;
    if (element === null) return;
    const viewport = scrollParent(element);
    if (viewport === null) return;
    const scroll = viewport;
    const measure = (): void => {
      if (element.clientWidth === 0 || scroll.clientHeight === 0) {
        return;
      }
      const css = getComputedStyle(element);
      const gapX = parseFloat(css.getPropertyValue('--space-12')) || 12;
      const gapY = parseFloat(css.getPropertyValue('--space-16')) || 16;
      const band = parseFloat(css.getPropertyValue('--size-thumb-band')) || 24;
      const {columns, tileWidth} = detailsGridGeometry(
        element.clientWidth,
        gapX,
        scale,
      );
      const stride = Math.max(1, (tileWidth * 9) / 16 + band + gapY);
      const top = Math.max(
        0,
        scroll.getBoundingClientRect().top -
          element.getBoundingClientRect().top,
      );
      const first = Math.max(
        0,
        Math.min(
          Math.max(0, Math.ceil(count / columns) - 1),
          Math.floor(top / stride) - OVERSCAN,
        ),
      );
      const last = Math.min(
        Math.ceil(count / columns),
        Math.ceil((top + scroll.clientHeight) / stride) + OVERSCAN,
      );
      setRange({
        start: first * columns,
        end: Math.min(count, Math.max(first, last) * columns),
        stride,
        columns,
        tileWidth,
      });
    };
    measure();
    scroll.addEventListener('scroll', measure, {passive: true});
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    observer?.observe(scroll);
    return () => {
      scroll.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [count, scale]);
  const start = range.stride === 0 ? 0 : range.start;
  const end = range.stride === 0 ? Math.min(count, INITIAL_COUNT) : range.end;
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null || index < start || index >= end) return;
    const options =
      host.current?.querySelectorAll<HTMLElement>('[role="option"]');
    options?.[index - start]?.focus({preventScroll: true});
    pendingFocus.current = null;
  }, [start, end, selected]);
  const select = (index: number): void => {
    onSelect(index);
    pendingFocus.current = index;
    const element = host.current;
    if (element === null || range.stride === 0) return;
    const viewport = scrollParent(element);
    if (viewport === null) return;
    const top =
      element.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop +
      Math.floor(index / range.columns) * range.stride;
    reveal(viewport, top, range.stride);
  };
  return (
    <div
      ref={host}
      onKeyDownCapture={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
          return;
        }
        const moves: Record<string, number> = {
          ArrowLeft: selected - 1,
          ArrowRight: selected + 1,
          ArrowUp: selected - range.columns,
          ArrowDown: selected + range.columns,
          Home: 0,
          End: count - 1,
        };
        const proposed = moves[event.key];
        if (proposed === undefined || count === 0) return;
        event.preventDefault();
        event.stopPropagation();
        select(Math.max(0, Math.min(count - 1, proposed)));
      }}
      onDoubleClick={event => {
        const option =
          event.target instanceof Element
            ? event.target.closest('[role="option"]')
            : null;
        if (option === null) return;
        const local = Array.from(
          event.currentTarget.querySelectorAll('[role="option"]'),
        ).indexOf(option);
        if (local >= 0) onEdit(start + local);
      }}
    >
      <div
        aria-hidden="true"
        style={{height: Math.floor(start / range.columns) * range.stride}}
      />
      <ThumbnailGrid
        workspace="prep"
        preventSelectionScroll
        label="슬라이드"
        columns={range.columns}
        tileWidth={range.tileWidth}
        className={styles.grid}
        positionOffset={start}
        setSize={count}
        selected={
          selected >= start && selected < end ? selected - start : undefined
        }
        onSelect={index => onSelect(start + index)}
      >
        {Array.from({length: Math.max(0, end - start)}, (_, local) => {
          const index = start + local;
          return (
            <SlideThumbnail
              key={reflowIds[index] ?? index}
              reflowId={reflowIds[index]}
              number={index + 1}
              label={labelAt(index)}
              labelColor={colorAt(index)}
              canvas={picture(index)}
              selected={index === selected}
            />
          );
        })}
      </ThumbnailGrid>
      <div
        aria-hidden="true"
        style={{
          height: Math.max(
            0,
            Math.ceil((count - end) / range.columns) * range.stride,
          ),
        }}
      />
    </div>
  );
}
