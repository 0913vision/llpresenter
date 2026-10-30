import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import type {QuickItem} from '@core/schema/quick';

const FALLBACK_ROW = 30;
const INITIAL_ROWS = 10;
const OVERSCAN = 3;

export function useQuickWindow(items: readonly QuickItem[]) {
  const list = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({top: 0, height: 0, row: FALLBACK_ROW});
  const [pinned, setPinned] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const pin = useCallback(
    (id: string, active: boolean) =>
      setPinned(old => (active ? id : old === id ? null : old)),
    [],
  );
  const pending = useRef<string | null>(null);
  const measure = useCallback(() => {
    const node = list.current;
    const viewport = node?.parentElement;
    if (!node || !viewport) return;
    const height =
      node
        .querySelector<HTMLElement>('[data-quick-id]')
        ?.getBoundingClientRect().height ?? 0;
    const row = height > 0 ? height : FALLBACK_ROW;
    const next = {top: viewport.scrollTop, height: viewport.clientHeight, row};
    setView(old =>
      old.top === next.top && old.height === next.height && old.row === next.row
        ? old
        : next,
    );
  }, []);
  useLayoutEffect(() => {
    const viewport = list.current?.parentElement;
    if (!viewport) return undefined;
    viewport.addEventListener('scroll', measure);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(viewport);
    measure();
    return () => {
      viewport.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure, items.length]);
  const visible =
    view.height > 0 ? Math.ceil(view.height / view.row) : INITIAL_ROWS;
  const start = Math.max(
    0,
    Math.min(
      Math.floor(view.top / view.row) - OVERSCAN,
      items.length - visible,
    ),
  );
  const end = Math.min(items.length, start + visible + OVERSCAN * 2);
  const shown = items.flatMap((item, index) =>
    (index >= start && index < end) || item.id === pinned || item.id === focused
      ? [{item, index}]
      : [],
  );
  useLayoutEffect(() => {
    const id = pending.current;
    if (id === null) return;
    const button = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-quick-id]') ?? []),
    ]
      .find(row => row.dataset['quickId'] === id)
      ?.querySelector<HTMLButtonElement>('button');
    if (button) {
      button.focus({preventScroll: true});
      pending.current = null;
    }
  }, [shown, view.top]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.shiftKey && event.key !== 'Tab')
    ) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
      return;
    }
    const row = target.closest<HTMLElement>('[data-quick-id]');
    const index = items.findIndex(item => item.id === row?.dataset['quickId']);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'ArrowDown':
        next = Math.min(items.length - 1, index + 1);
        break;
      case 'ArrowUp':
        next = Math.max(0, index - 1);
        break;
      case 'Tab':
        next = index + (event.shiftKey ? -1 : 1);
        break;
      default:
        return;
    }
    const item = items[next];
    const viewport = list.current?.parentElement;
    if (!item || !viewport) return;
    event.preventDefault();
    event.stopPropagation();
    pending.current = item.id;
    const rowTop = next * view.row;
    if (rowTop < viewport.scrollTop) {
      viewport.scrollTo({top: rowTop});
    } else if (rowTop + view.row > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTo({top: rowTop + view.row - viewport.clientHeight});
    }
    measure();
    const button = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-quick-id]') ?? []),
    ]
      .find(element => element.dataset['quickId'] === item.id)
      ?.querySelector<HTMLButtonElement>('button');
    if (button) {
      button.focus({preventScroll: true});
      pending.current = null;
    }
  };
  return {
    shown,
    rowHeight: view.row,
    onKeyDown,
    pin,
    list,
    onFocusCapture: (event: FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !event.currentTarget.contains(target)
      ) {
        return;
      }
      setFocused(
        target.closest<HTMLElement>('[data-quick-id]')?.dataset['quickId'] ??
          null,
      );
    },
    onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !event.currentTarget.contains(event.relatedTarget)
      ) {
        setFocused(null);
      }
    },
  };
}
