import {useLayoutEffect, useRef, type JSX, type KeyboardEvent} from 'react';
import {listKeyTarget, useRowRange} from '@renderer/ui/lists/useRowRange';
import type {Timer} from '@core/schema/timers';
import type {LlpApi} from '@contracts/ipc/api';
import {TimerRow} from './TimerRow';
import type {Notice} from '@renderer/ui/popups/notices';
import {useReflow} from '@renderer/ui/panels/useReflow';
import styles from './TimerTab.module.css';

const INITIAL_ROWS = 4;
const OVERSCAN = 2;
const rowHeight = (list: HTMLElement): number =>
  list.querySelector<HTMLElement>('[data-timer-row]')?.getBoundingClientRect()
    .height ?? 0;

/** The part of a timer row that takes the focus. */
function focusTarget(row: HTMLElement): HTMLElement {
  return (
    row.querySelector<HTMLElement>('button') ??
    row.querySelector<HTMLElement>('[role=group]') ??
    row
  );
}

export function WindowedTimers({
  api,
  timers,
  editable = false,
  copyReason,
  onProblem,
  onRemove,
}: {
  readonly api: LlpApi;
  readonly timers: readonly Timer[];
  readonly editable?: boolean;
  readonly copyReason?: string | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onRemove?: ((timer: Timer) => void) | undefined;
}): JSX.Element {
  const {viewport, start, end, view, measure, show} = useRowRange({
    count: timers.length,
    rowHeight,
    initialRows: INITIAL_ROWS,
    overscan: OVERSCAN,
  });
  useReflow(viewport, {
    ids: timers.map(timer => timer.id),
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: 'timers',
  });
  const pendingFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null || index < start || index >= end) return;
    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-timer-row="${index}"]`,
    );
    if (row) focusTarget(row).focus({preventScroll: true});
    pendingFocus.current = null;
  }, [start, end, view.top, viewport]);
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
    const target = listKeyTarget(event.key, current, timers.length);
    const node = viewport.current;
    if (target === undefined || !node) return;
    event.preventDefault();
    event.stopPropagation();
    pendingFocus.current = target;
    show(target);
    const rendered = node.querySelector<HTMLElement>(
      `[data-timer-row="${target}"]`,
    );
    if (rendered) {
      focusTarget(rendered).focus({preventScroll: true});
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
            data-reflow-id={timer.id}
            role="listitem"
            tabIndex={-1}
            style={{top: (start + offset) * view.row}}
          >
            <TimerRow
              api={api}
              timer={timer}
              editable={editable}
              copyReason={copyReason}
              onProblem={onProblem}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
