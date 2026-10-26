import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {MediaStrip} from '@renderer/ui';
import styles from './ShowMediaPanel.module.css';

const OVERSCAN = 4;
const INITIAL_TILES = 6;
const MAX_PREVIEW_VIDEOS = 8;
const OPTIONS = '[role="option"]';

/** Keeps the horizontal strip's DOM and previews bounded by the viewport. */
export function WindowedMediaStrip({
  count,
  selected,
  onSelect,
  onActivate,
  isVideo,
  tile,
}: {
  readonly count: number;
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
  readonly onActivate: (index: number) => void;
  readonly isVideo: (index: number) => boolean;
  readonly tile: (
    index: number,
    options: {readonly videoPreview: boolean},
  ) => ReactNode;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement | null>(null);
  const focusNext = useRef<number | null>(null);
  const [view, setView] = useState({
    left: 0,
    width: 0,
    stride: 1,
    gap: 0,
    inset: 0,
  });
  const measure = useCallback(() => {
    const list =
      viewport.current?.querySelector<HTMLElement>('[role="listbox"]');
    if (!list) return;
    const css = getComputedStyle(list);
    const width =
      Number.parseFloat(css.getPropertyValue('--size-media-strip-tile')) || 1;
    const gap = Number.parseFloat(css.columnGap) || 0;
    const next = {
      left: list.scrollLeft,
      width: list.clientWidth,
      stride: width + gap,
      gap,
      inset: Number.parseFloat(css.paddingLeft) || 0,
    };
    setView(current =>
      current.left === next.left &&
      current.width === next.width &&
      current.stride === next.stride &&
      current.gap === next.gap &&
      current.inset === next.inset
        ? current
        : next,
    );
  }, []);
  const attach = useCallback(
    (node: HTMLDivElement | null): void => {
      viewport.current = node;
      if (node) measure();
    },
    [measure],
  );
  useLayoutEffect(() => {
    const list =
      viewport.current?.querySelector<HTMLElement>('[role="listbox"]');
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);
  const visible =
    view.width > 0 ? Math.ceil(view.width / view.stride) : INITIAL_TILES;
  const start = Math.max(
    0,
    Math.min(Math.floor(view.left / view.stride) - OVERSCAN, count - visible),
  );
  const end = Math.min(count, start + visible + OVERSCAN * 2);
  const videoPreviews = new Set<number>();
  for (
    let index = start;
    view.width > 0 && index < end && videoPreviews.size < MAX_PREVIEW_VIDEOS;
    index++
  ) {
    const left = view.inset + index * view.stride;
    const right = left + view.stride - view.gap;
    if (right > view.left && left < view.left + view.width && isVideo(index)) {
      videoPreviews.add(index);
    }
  }
  useLayoutEffect(() => {
    const target = focusNext.current;
    if (target === null || target < start || target >= end) return;
    const options = viewport.current?.querySelectorAll<HTMLElement>(OPTIONS);
    options?.[target - start]?.focus({preventScroll: true});
    focusNext.current = null;
  }, [start, end, selected]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const list =
      viewport.current?.querySelector<HTMLElement>('[role="listbox"]');
    const option =
      event.target instanceof Element ? event.target.closest(OPTIONS) : null;
    if (!list || !option) return;
    const current = start + [...list.querySelectorAll(OPTIONS)].indexOf(option);
    const targets: Readonly<Record<string, number>> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: count - 1,
    };
    const proposed = targets[event.key];
    if (proposed === undefined || count === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = Math.max(0, Math.min(count - 1, proposed));
    focusNext.current = target;
    list.scrollLeft = Math.max(0, target * view.stride - view.width / 2);
    measure();
    onSelect(target);
  };
  return (
    <div
      ref={attach}
      className={styles.viewport}
      onScrollCapture={measure}
      onKeyDownCapture={navigate}
    >
      <MediaStrip
        label="미디어"
        className={styles.windowed}
        positionOffset={start}
        setSize={count}
        orientation="horizontal"
        selected={
          selected !== undefined && selected >= start && selected < end
            ? selected - start
            : undefined
        }
        onSelect={index => onSelect(start + index)}
        onActivate={index => onActivate(start + index)}
      >
        {start > 0 ? (
          <span
            aria-hidden="true"
            className={styles.spacer}
            style={{width: start * view.stride - view.gap}}
          />
        ) : null}
        {Array.from({length: end - start}, (_, offset) =>
          tile(start + offset, {
            videoPreview: videoPreviews.has(start + offset),
          }),
        )}
        {end < count ? (
          <span
            aria-hidden="true"
            className={styles.spacer}
            style={{width: (count - end) * view.stride - view.gap}}
          />
        ) : null}
      </MediaStrip>
    </div>
  );
}
