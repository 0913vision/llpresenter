import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import {isComposing} from '@renderer/ui/ime';

const INITIAL_ROWS = 8;
const OVERSCAN_ROWS = 2;
type FieldPart = 'input' | 'button';
interface FocusTarget {
  readonly index: number;
  readonly part: FieldPart;
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
      const gap = Number.parseFloat(css.getPropertyValue('--space-10')) || 0;
      const row =
        Number.parseFloat(css.getPropertyValue('--size-control-md')) || 0;
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
    const index = Number(row.dataset['headerIndex']);
    const part = target instanceof HTMLInputElement ? 'input' : 'button';
    let next: FocusTarget | undefined;
    if (event.key === 'Tab') {
      if (event.shiftKey && part === 'input' && index > 0) {
        next = {index: index - 1, part: 'button'};
      } else if (!event.shiftKey && part === 'button' && index + 1 < count) {
        next = {index: index + 1, part: 'input'};
      }
    } else if (!event.shiftKey) {
      const proposed =
        event.key === 'PageDown'
          ? index + visible
          : event.key === 'PageUp'
            ? index - visible
            : part === 'button' && event.key === 'Home'
              ? 0
              : part === 'button' && event.key === 'End'
                ? count - 1
                : undefined;
      if (proposed !== undefined) {
        next = {index: Math.max(0, Math.min(count - 1, proposed)), part};
      }
    }
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
