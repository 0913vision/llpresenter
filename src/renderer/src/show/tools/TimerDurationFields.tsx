import type {JSX} from 'react';
import {MAX_TIMER_SECONDS} from '@shared/schema/timers';
import {PropertyRow, TextField} from '@renderer/ui';

const SECONDS_PER_MINUTE = 60;
const SECONDS_MAX = SECONDS_PER_MINUTE - 1;
const wholeNumber = (text: string, max: number): boolean =>
  /^\d+$/u.test(text) &&
  Number.isSafeInteger(Number(text)) &&
  Number(text) <= max;

export function parseTimerDuration(minutes: string, seconds: string) {
  const minutesReason = wholeNumber(
    minutes,
    Math.floor(MAX_TIMER_SECONDS / SECONDS_PER_MINUTE),
  )
    ? undefined
    : '분은 설정 가능한 0 이상의 정수여야 합니다';
  const secondsReason = wholeNumber(seconds, SECONDS_MAX)
    ? undefined
    : '초는 0부터 59까지의 정수여야 합니다';
  const duration = Number(minutes) * SECONDS_PER_MINUTE + Number(seconds);
  const totalReason =
    duration === 0
      ? '시간은 0보다 커야 합니다'
      : duration > MAX_TIMER_SECONDS
        ? '설정할 수 있는 시간을 넘었습니다'
        : undefined;
  return {
    minutesReason: minutesReason ?? totalReason,
    secondsReason,
    duration:
      minutesReason || secondsReason || totalReason ? undefined : duration,
  };
}

export function TimerDurationFields({
  minutes,
  seconds,
  onMinutesChange,
  onSecondsChange,
  disabled = false,
}: {
  readonly minutes: string;
  readonly seconds: string;
  readonly onMinutesChange: (value: string) => void;
  readonly onSecondsChange: (value: string) => void;
  readonly disabled?: boolean;
}): JSX.Element {
  const draft = parseTimerDuration(minutes, seconds);
  return (
    <>
      <PropertyRow label="분">
        {({controlId}) => (
          <TextField
            id={controlId}
            aria-label="분"
            numeric
            inputMode="numeric"
            block
            autoFocus
            value={minutes}
            onChange={onMinutesChange}
            readOnly={disabled}
            invalid={draft.minutesReason !== undefined}
            invalidReason={draft.minutesReason}
            onFocus={event => event.currentTarget.select()}
          />
        )}
      </PropertyRow>
      <PropertyRow label="초">
        {({controlId}) => (
          <TextField
            id={controlId}
            aria-label="초"
            numeric
            inputMode="numeric"
            block
            value={seconds}
            onChange={onSecondsChange}
            readOnly={disabled}
            invalid={draft.secondsReason !== undefined}
            invalidReason={draft.secondsReason}
            onFocus={event => event.currentTarget.select()}
          />
        )}
      </PropertyRow>
    </>
  );
}
