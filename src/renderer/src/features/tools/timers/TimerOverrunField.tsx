import type {JSX} from 'react';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';

/** The 0 지나면 choice of a countdown: 계속 or 정지. */
export function TimerOverrunField({
  value,
  onChange,
  disabled,
}: {
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled: boolean;
}): JSX.Element {
  return (
    <PropertyRow label="0 지나면">
      {({controlId}) => (
        <SegmentedControl
          id={controlId}
          label="0 지나면"
          fill
          disabled={disabled}
          value={value ? 'continue' : 'stop'}
          onChange={choice => onChange(choice === 'continue')}
          options={[
            {value: 'continue', label: '계속'},
            {value: 'stop', label: '정지'},
          ]}
        />
      )}
    </PropertyRow>
  );
}
