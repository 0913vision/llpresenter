import {useLayoutEffect, useRef, type RefObject} from 'react';

const PAUSE_MS = 1500;
const BAND_START = 0.3;
const BAND_END = 0.55;
const TARGET = 0.4;

function follow(list: HTMLElement | null, id: string | null): void {
  const viewport = list?.parentElement;
  if (!list || !viewport || id === null || viewport.clientHeight <= 0) return;
  const row = Array.from(
    list.querySelectorAll<HTMLElement>('[data-order-id]'),
  ).find(element => element.dataset['orderId'] === id);
  if (!row) return;
  const bounds = row.getBoundingClientRect();
  const relative =
    (bounds.top + bounds.bottom) / 2 - viewport.getBoundingClientRect().top;
  if (
    relative >= viewport.clientHeight * BAND_START &&
    relative <= viewport.clientHeight * BAND_END
  ) {
    return;
  }
  const top = Math.max(
    0,
    viewport.scrollTop + relative - viewport.clientHeight * TARGET,
  );
  if (Math.abs(top - viewport.scrollTop) >= 1) {
    viewport.scrollTo({top, behavior: 'smooth'});
  }
}

/** Follows the live order item without overriding an operator's recent scroll. */
export function useOrderFollow(
  list: RefObject<HTMLDivElement | null>,
  {
    target,
    enabled,
    rows,
  }: {
    readonly target: string | null;
    readonly enabled: boolean;
    readonly rows: readonly unknown[];
  },
): void {
  const pausedUntil = useRef(0);
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    const viewport = list.current?.parentElement;
    if (!enabled || !viewport) return;
    const defer = (): void => {
      pausedUntil.current = Date.now() + PAUSE_MS;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (!dragging.current) current.current();
      }, PAUSE_MS);
    };
    const down = (event: PointerEvent): void => {
      if (event.target !== viewport && event.pointerType !== 'touch') return;
      dragging.current = true;
      defer();
    };
    const move = (): void => {
      if (dragging.current) defer();
    };
    const up = (): void => {
      if (dragging.current) {
        dragging.current = false;
        defer();
      }
    };
    viewport.addEventListener('wheel', defer, {passive: true});
    viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      viewport.removeEventListener('wheel', defer);
      viewport.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = undefined;
      dragging.current = false;
      pausedUntil.current = 0;
    };
  }, [enabled, list]);
  useLayoutEffect(() => {
    current.current = () => {
      if (enabled && !dragging.current && Date.now() >= pausedUntil.current) {
        follow(list.current, target);
      }
    };
    current.current();
  }, [enabled, list, target, rows]);
}
