import {useLayoutEffect, useRef, type JSX, type KeyboardEvent} from 'react';
import {listKeyTarget, useRowRange} from '@renderer/ui/lists/useRowRange';
import type {LlpApi} from '@contracts/ipc/api';
import {AudioTrackRow} from './AudioTrackRow';
import type {AudioTrack} from '@core/media';
import styles from './WindowedAudioTracks.module.css';

const INITIAL_ROWS = 12;
const OVERSCAN = 3;
const rowHeight = (list: HTMLElement): number =>
  list.querySelector<HTMLElement>('[data-audio-row]')?.getBoundingClientRect()
    .height ?? 0;

/** The tracks of an audio playlist, drawing only the rows in view. */
export function WindowedAudioTracks({
  api,
  tracks,
}: {
  readonly api: LlpApi;
  readonly tracks: readonly AudioTrack[];
}): JSX.Element {
  const {viewport, start, end, view, measure, show} = useRowRange({
    count: tracks.length,
    rowHeight,
    initialRows: INITIAL_ROWS,
    overscan: OVERSCAN,
  });
  const focus = useRef<number | null>(null);
  useLayoutEffect(() => {
    const index = focus.current;
    if (index === null || index < start || index >= end) return;
    viewport.current
      ?.querySelector<HTMLButtonElement>(`[data-audio-row="${index}"] button`)
      ?.focus({preventScroll: true});
    focus.current = null;
  }, [start, end, view.top, viewport]);
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
    const bounded = listKeyTarget(event.key, current, tracks.length);
    const node = viewport.current;
    if (bounded === undefined || !node) return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
    let target = bounded;
    while (target >= 0 && target < tracks.length && tracks[target]?.missing) {
      target += direction;
    }
    if (target < 0 || target >= tracks.length) return;
    focus.current = target;
    show(target);
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
