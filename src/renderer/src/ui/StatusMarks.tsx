import type {JSX} from 'react';
import {classNames} from './classNames';
import styles from './StatusMarks.module.css';

const LIVE_TEXT = 'LIVE';
const COUNT_LIMIT = 99;
const PERCENT_MAX = 100;

/** The LIVE badge at the right end of a row that is on the screens now. */
export function LiveBadge({
  className,
}: {
  readonly className?: string | undefined;
}): JSX.Element {
  return (
    <span className={classNames(styles.badge, className)}>{LIVE_TEXT}</span>
  );
}

/** What a status dot reports: healthy, a problem, on the screens, or off. */
export type DotTone = 'ok' | 'warning' | 'live' | 'off';

export interface StatusDotProps {
  readonly tone: DotTone;
  /** Adds the ring that cuts the dot free when it sits on top of an icon. */
  readonly cut?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * A 6px status dot. It is decoration for assistive technology, so the parent
 * carries the name of the state.
 */
export function StatusDot({
  tone,
  cut = false,
  className,
}: StatusDotProps): JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={classNames(styles.dot, cut && styles.cut, className)}
    />
  );
}

/** The text of a count badge: the number, or 99+ above 99. */
export function countText(value: number): string {
  return value > COUNT_LIMIT ? `${COUNT_LIMIT}+` : String(value);
}

/** A count after a panel tab name. Draws nothing for zero. */
export function CountBadge({
  value,
  className,
}: {
  readonly value: number;
  readonly className?: string | undefined;
}): JSX.Element | null {
  if (value <= 0) return null;
  return (
    <span className={classNames(styles.count, className)}>
      {countText(value)}
    </span>
  );
}

/** A finite task in progress, or the playback position of audio and video. */
export type ProgressVariant = 'task' | 'playback';

export interface ProgressProps {
  /** How far along it is, from 0 to 100. */
  readonly value: number;
  /** The task name, such as 부활절 배경.mp4 복사. */
  readonly label: string;
  readonly variant?: ProgressVariant | undefined;
  /** The position as read aloud, such as 1:24 / 3:42. */
  readonly valueText?: string | undefined;
  readonly className?: string | undefined;
}

/** Keeps a progress value between 0 and 100. */
export function progressPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(PERCENT_MAX, Math.max(0, value));
}

/** A 4px progress bar, drawn at the value as received with no animation. */
export function Progress({
  value,
  label,
  variant = 'task',
  valueText,
  className,
}: ProgressProps): JSX.Element {
  const percent = progressPercent(value);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={PERCENT_MAX}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      className={classNames(
        styles.progress,
        variant === 'playback' && styles.playback,
        className,
      )}
    >
      <span className={styles.bar} style={{width: `${percent}%`}} />
    </span>
  );
}
