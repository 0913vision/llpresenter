import type {JSX} from 'react';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';

const SECONDS = [30, 60, 120];

/** `30초`, `1분`, `2분`; a stored time off the list in seconds. */
function timeLabel(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60}분`
    : `${seconds}초`;
}

/**
 * 표시 시간 of a message: 계속 (null) until it is hidden, or a number of
 * seconds. The saved time stays offered when it is not on the list.
 */
export function DisplayTimeRow({
  duration,
  saved = duration,
  onChange,
  label,
  locked = false,
}: {
  readonly duration: number | null;
  /** The time saved with the message; the shown one when not given. */
  readonly saved?: number | null | undefined;
  readonly onChange: (duration: number | null) => void;
  /** The select's own name, where the row's label is not enough. */
  readonly label?: string;
  readonly locked?: boolean;
}): JSX.Element {
  const seconds =
    saved === null || SECONDS.includes(saved)
      ? SECONDS
      : [...SECONDS, saved].sort((a, b) => a - b);
  return (
    <PropertyRow label="표시 시간">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          {...(label === undefined ? {} : {'aria-label': label})}
          block
          disabled={locked}
          value={duration === null ? 'until' : String(duration)}
          options={[
            {value: 'until', label: '계속'},
            ...seconds.map(value => ({
              value: String(value),
              label: timeLabel(value),
            })),
          ]}
          onChange={value => onChange(value === 'until' ? null : Number(value))}
        />
      )}
    </PropertyRow>
  );
}
