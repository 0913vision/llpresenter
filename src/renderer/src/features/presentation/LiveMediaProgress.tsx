import {useEffect, useState, type JSX} from 'react';
import type {MediaProgress} from '@core/schema/mediaProgress';
import {useLive} from '@renderer/session/live';
import {durationText} from '@renderer/features/media/mediaEntries';
import styles from './LiveMediaProgress.module.css';

function sameShownSecond(
  a: MediaProgress | null,
  b: MediaProgress | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.mediaId === b.mediaId &&
    a.startedAt === b.startedAt &&
    Math.floor(a.positionSeconds) === Math.floor(b.positionSeconds) &&
    remainingSecond(a) === remainingSecond(b)
  );
}

function remainingSecond(reading: MediaProgress): number | null {
  return reading.durationSeconds === null
    ? null
    : Math.ceil(Math.max(0, reading.durationSeconds - reading.positionSeconds));
}

/** Displays main's samples; this view never advances playback time itself. */
export function LiveMediaProgress(): JSX.Element | null {
  const media = useLive(view => view.state?.layers.media);
  const mediaId = media?.mediaId;
  const startedAt = media?.startedAt;
  const [reading, setReading] = useState<MediaProgress | null>(null);
  useEffect(() => {
    const api = window.llp?.live;
    if (api === undefined || mediaId === undefined) return;
    let active = true;
    let pushed = false;
    const accept = (value: MediaProgress | null): void => {
      if (active) {
        setReading(current =>
          sameShownSecond(current, value) ? current : value,
        );
      }
    };
    const stop = api.subscribeMediaProgress(value => {
      pushed = true;
      accept(value);
    });
    api.mediaProgress().then(
      value => {
        if (!pushed) accept(value);
      },
      () => undefined,
    );
    return () => {
      active = false;
      stop();
    };
  }, [mediaId, startedAt]);
  if (
    reading === null ||
    reading.mediaId !== mediaId ||
    reading.startedAt !== startedAt
  ) {
    return null;
  }
  const position = durationText(reading.positionSeconds);
  const remaining =
    reading.durationSeconds === null
      ? undefined
      : `-${durationText(Math.ceil(Math.max(0, reading.durationSeconds - reading.positionSeconds)))}`;
  return (
    <div className={styles.progress}>
      <progress
        aria-label="배경 영상 재생 위치"
        aria-valuetext={[position, remaining].filter(Boolean).join(', ')}
        max={reading.durationSeconds ?? 1}
        value={
          reading.durationSeconds === null ? undefined : reading.positionSeconds
        }
      />
      <div className={styles.times}>
        <span>{position}</span>
        <span>{remaining}</span>
      </div>
    </div>
  );
}
