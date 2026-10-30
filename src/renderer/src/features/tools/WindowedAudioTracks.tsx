import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {AudioTrackRow} from './AudioTrackRow';
import type {AudioTrack} from '@core/media/audioTracks';
import styles from './WindowedAudioTracks.module.css';

const INITIAL_ROWS = 12;
const OVERSCAN = 3;

export function WindowedAudioTracks({
  api,
  tracks,
}: {
  readonly api: LlpApi;
  readonly tracks: readonly AudioTrack[];
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const focus = useRef<number | null>(null);
  const [view, setView] = useState({top: 0, height: 0, row: 0});
  const measure = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const next = {
      top: node.scrollTop,
      height: node.clientHeight,
      row:
        node
          .querySelector<HTMLElement>('[data-audio-row]')
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
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, tracks.length]);
  const visible =
    view.height > 0 && view.row > 0
      ? Math.ceil(view.height / view.row)
      : INITIAL_ROWS;
  const start = Math.max(
    0,
    Math.min(
      Math.floor(view.top / (view.row || 1)) - OVERSCAN,
      tracks.length - visible,
    ),
  );
  const end = Math.min(tracks.length, start + visible + OVERSCAN * 2);
  useLayoutEffect(() => {
    const index = focus.current;
    if (index === null || index < start || index >= end) return;
    viewport.current
      ?.querySelector<HTMLButtonElement>(`[data-audio-row="${index}"] button`)
      ?.focus({preventScroll: true});
    focus.current = null;
  }, [start, end, view.top]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      tracks.length === 0
    ) {
      return;
    }
    const row =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-audio-row]')
        : null;
    if (row === null && event.target !== event.currentTarget) return;
    const current = Number(row?.dataset['audioRow'] ?? -1);
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: tracks.length - 1,
    };
    const next = targets[event.key];
    const node = viewport.current;
    if (next === undefined || !node) return;
    event.preventDefault();
    const bounded = Math.max(0, Math.min(tracks.length - 1, next));
    const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
    let target = bounded;
    while (target >= 0 && target < tracks.length && tracks[target]?.missing) {
      target += direction;
    }
    if (target < 0 || target >= tracks.length) return;
    focus.current = target;
    node.scrollTop = Math.max(0, target * view.row - node.clientHeight / 2);
    measure();
    const rendered = node.querySelector<HTMLButtonElement>(
      `[data-audio-row="${target}"] button`,
    );
    if (rendered) {
      rendered.focus({preventScroll: true});
      focus.current = null;
    }
  };
  return (
    <div
      className={styles.viewport}
      ref={viewport}
      role="list"
      aria-label="오디오 트랙 목록"
      tabIndex={0}
      onScroll={measure}
      onKeyDown={navigate}
    >
      <div className={styles.rows} style={{height: view.row * tracks.length}}>
        {tracks.slice(start, end).map((track, offset) => (
          <div
            key={track.position}
            role="listitem"
            data-audio-row={start + offset}
            className={styles.slot}
            style={{top: (start + offset) * view.row}}
          >
            <AudioTrackRow api={api} track={track} />
          </div>
        ))}
      </div>
    </div>
  );
}
