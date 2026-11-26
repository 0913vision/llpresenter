import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import {isComposing} from '@renderer/ui/fields/ime';
import {tokenPixels} from '@renderer/ui/tokenPixels';

const INITIAL_ROWS = 8;
const OVERSCAN_ROWS = 2;
type FieldPart = 'input' | 'button';
interface FocusTarget {
  readonly index: number;
  readonly part: FieldPart;
}

/**
 * Where a key moves the focus among the rows of a window that shows only some
 * of them: Tab and Shift+Tab cross from a row's button to the next row's
 * field and back, Page Up and Page Down move a page, and Home and End jump
 * from a button (a field keeps them for its caret).
 */
export function nextFocus(
  {key, shift}: {readonly key: string; readonly shift: boolean},
  {index, part}: FocusTarget,
  {count, visible}: {readonly count: number; readonly visible: number},
): FocusTarget | undefined {
  if (key === 'Tab') {
    if (shift && part === 'input' && index > 0) {
      return {index: index - 1, part: 'button'};
    }
    if (!shift && part === 'button' && index + 1 < count) {
      return {index: index + 1, part: 'input'};
    }
    return undefined;
  }
  if (shift) return undefined;
  const pages: Record<string, number> = {
    PageDown: index + visible,
    PageUp: index - visible,
  };
  const jumps: Record<string, number> =
    part === 'button' ? {Home: 0, End: count - 1} : {};
  const proposed = pages[key] ?? jumps[key];
  return proposed === undefined
    ? undefined
    : {index: Math.max(0, Math.min(count - 1, proposed)), part};
}

/** Windows header fields while retaining the focused row and logical Tab order. */
export function useImportLabelWindow(count: number) {
  const viewport = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measure, setMeasure] = useState({height: 0, stride: 0, gap: 0});
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return;
    const read = (): void => {
      const css = getComputedStyle(node);
      const gap = tokenPixels(css, '--space-10');
      const row = tokenPixels(css, '--size-control-md');
      setMeasure({height: node.clientHeight, stride: row + gap, gap});
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const stride = measure.stride || 1;
  const visible =
    measure.height > 0 ? Math.ceil(measure.height / stride) : INITIAL_ROWS;
  const first = Math.max(
    0,
    Math.min(Math.floor(scrollTop / stride) - OVERSCAN_ROWS, count - visible),
  );
  const end = Math.min(count, first + visible + OVERSCAN_ROWS * 2);
  const indices = Array.from(
    {length: end - first},
    (_, offset) => first + offset,
  );
  if (focused !== null && (focused < first || focused >= end)) {
    indices.push(focused);
  }
  indices.sort((left, right) => left - right);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const field = viewport.current?.querySelector<HTMLElement>(
      `[data-header-index="${target.index}"] ${target.part}`,
    );
    if (field === null || field === undefined) return;
    pendingFocus.current = null;
    field.focus({preventScroll: true});
  });
  const focus = (target: FocusTarget): void => {
    if (target.index === focused) return;
    const node = viewport.current;
    if (node === null) return;
    const top = target.index * stride;
    const height = measure.height || visible * stride;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (top + stride > node.scrollTop + height) {
      node.scrollTop = top + stride - height;
    }
    pendingFocus.current = target;
    setFocused(target.index);
    setScrollTop(node.scrollTop);
  };
  const onFocusCapture = (event: FocusEvent<HTMLDivElement>): void => {
    const row = event.target.closest<HTMLElement>('[data-header-index]');
    if (row !== null) setFocused(Number(row.dataset['headerIndex']));
  };
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.defaultPrevented ||
      isComposing(event) ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLButtonElement)
    ) {
      return;
    }
    const row = target.closest<HTMLElement>('[data-header-index]');
    if (row === null) return;
    const next = nextFocus(
      {key: event.key, shift: event.shiftKey},
      {
        index: Number(row.dataset['headerIndex']),
        part: target instanceof HTMLInputElement ? 'input' : 'button',
      },
      {count, visible},
    );
    if (next === undefined) return;
    event.preventDefault();
    focus(next);
  };
  return {
    viewport,
    indices,
    stride,
    height: Math.max(0, count * stride - measure.gap),
    onFocusCapture,
    onKeyDownCapture,
    onScroll: (event: {readonly currentTarget: HTMLDivElement}) =>
      setScrollTop(event.currentTarget.scrollTop),
  };
}
