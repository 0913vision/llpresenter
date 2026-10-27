import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {Timer} from '@shared/schema/timers';
import type {LlpApi} from '@shared/ipc';
import {TimerRow} from './TimerRow';
import type {Notice} from '@renderer/ui/notices';
import styles from './TimerTab.module.css';

const INITIAL_ROWS = 4;
const OVERSCAN = 2;

export function WindowedTimers({
  api,
  timers,
  editable = false,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly timers: readonly Timer[];
  readonly editable?: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [view, setView] = useState({top: 0, height: 0, row: 0});
  const measure = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const next = {
      top: node.scrollTop,
      height: node.clientHeight,
      row:
        node
          .querySelector<HTMLElement>('[data-timer-row]')
          ?.getBoundingClientRect().height ?? 0,
    };
    setView(old =>
      old.top === next.top && old.height === next.height && old.row === next.row
        ? old
        : next,
    );
  }, []);
  useLayoutEffect(() => {
    measure();
    const node = viewport.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, timers.length]);
  const visible =
    view.height > 0 && view.row > 0
      ? Math.ceil(view.height / view.row)
      : INITIAL_ROWS;
  const start = Math.max(
    0,
    Math.min(
      Math.floor(view.top / (view.row || 1)) - OVERSCAN,
      timers.length - visible,
    ),
  );
  const end = Math.min(timers.length, start + visible + OVERSCAN * 2);
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null || index < start || index >= end) return;
    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-timer-row="${index}"]`,
    );
    (
      row?.querySelector<HTMLElement>('button') ??
      row?.querySelector<HTMLElement>('[role=group]') ??
      row
    )?.focus({
      preventScroll: true,
    });
    pendingFocus.current = null;
  }, [start, end, view.top]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      timers.length === 0
    ) {
      return;
    }
    const row =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-timer-row]')
        : null;
    if (row === null && event.target !== event.currentTarget) return;
    const current = Number(row?.dataset['timerRow'] ?? -1);
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: timers.length - 1,
    };
    const proposed = targets[event.key];
    const node = viewport.current;
    if (proposed === undefined || !node) return;
    event.preventDefault();
    event.stopPropagation();
    const target = Math.max(0, Math.min(timers.length - 1, proposed));
    pendingFocus.current = target;
    node.scrollTop = Math.max(0, target * view.row - node.clientHeight / 2);
    measure();
    const rendered = node.querySelector<HTMLElement>(
      `[data-timer-row="${target}"]`,
    );
    if (rendered) {
      (
        rendered.querySelector<HTMLElement>('button') ??
        rendered.querySelector<HTMLElement>('[role=group]') ??
        rendered
      ).focus({
        preventScroll: true,
      });
      pendingFocus.current = null;
    }
  };
  return (
    <div
      className={styles.list}
      ref={viewport}
      role="list"
      aria-label="타이머 목록"
      tabIndex={0}
      onScroll={measure}
      onKeyDown={navigate}
    >
      <div className={styles.rows} style={{height: view.row * timers.length}}>
        {timers.slice(start, end).map((timer, offset) => (
          <div
            key={timer.id}
            className={styles.slot}
            data-timer-row={start + offset}
            role="listitem"
            tabIndex={-1}
            style={{top: (start + offset) * view.row}}
          >
            <TimerRow
              api={api}
              timer={timer}
              editable={editable}
              onProblem={onProblem}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
