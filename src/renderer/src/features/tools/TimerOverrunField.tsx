import type {JSX} from 'react';
import {PropertyRow, SegmentedControl} from '@renderer/ui';

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
            {value: 'stop', label: '멈춤'},
          ]}
        />
      )}
    </PropertyRow>
  );
}
