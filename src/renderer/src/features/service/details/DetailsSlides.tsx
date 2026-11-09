import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {SlideThumbnail, ThumbnailGrid} from '@renderer/ui/SlideThumbnail';

const COLUMNS = 2;
const INITIAL_COUNT = 8;
const OVERSCAN = 2;
interface Range {
  readonly start: number;
  readonly end: number;
  readonly stride: number;
}
function scrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (
    parent !== null &&
    !['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)
  ) {
    parent = parent.parentElement;
  }
  return parent;
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
  selected,
  onSelect,
  onEdit,
  labelAt,
  colorAt,
  picture,
}: {
  readonly count: number;
  readonly selected: number;
  readonly onSelect: (index: number) => void;
  readonly onEdit: (index: number) => void;
  readonly labelAt: (index: number) => string | undefined;
  readonly colorAt: (index: number) => LabelColor;
  readonly picture: (index: number) => ReactNode;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [range, setRange] = useState<Range>({
    start: 0,
    end: Math.min(count, INITIAL_COUNT),
    stride: 0,
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
      const stride = Math.max(
        1,
        (((element.clientWidth - gapX) / COLUMNS) * 9) / 16 + band + gapY,
      );
      const top = Math.max(
        0,
        scroll.getBoundingClientRect().top -
          element.getBoundingClientRect().top,
      );
      const first = Math.max(
        0,
        Math.min(
          Math.max(0, Math.ceil(count / COLUMNS) - 1),
          Math.floor(top / stride) - OVERSCAN,
        ),
      );
      const last = Math.min(
        Math.ceil(count / COLUMNS),
        Math.ceil((top + scroll.clientHeight) / stride) + OVERSCAN,
      );
      setRange({
        start: first * COLUMNS,
        end: Math.min(count, Math.max(first, last) * COLUMNS),
        stride,
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
  }, [count]);
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
      Math.floor(index / COLUMNS) * range.stride;
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
          ArrowUp: selected - COLUMNS,
          ArrowDown: selected + COLUMNS,
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
        style={{height: Math.floor(start / COLUMNS) * range.stride}}
      />
      <ThumbnailGrid
        workspace="prep"
        label="슬라이드"
        columns={COLUMNS}
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
              key={index}
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
            Math.ceil((count - end) / COLUMNS) * range.stride,
          ),
        }}
      />
    </div>
  );
}
