import {useState, type JSX} from 'react';
import {Dialog, Properties, PropertyRow, SegmentedControl} from '@renderer/ui';
import {parseTimerDuration, TimerDurationFields} from './TimerDurationFields';

export function CountdownDialog({
  locked,
  onSave,
  onClose,
}: {
  readonly locked: boolean;
  readonly onSave: (fields: {
    readonly duration: number;
    readonly overrun: boolean;
  }) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [overrun, setOverrun] = useState(true);
  const draft = parseTimerDuration(minutes, seconds);
  const save = (): void => {
    if (locked || draft.duration === undefined) return;
    onSave({duration: draft.duration, overrun})
      .then(saved => {
        if (saved) onClose();
      })
      .catch((cause: unknown) =>
        console.error('Countdown save callback failed:', cause),
      );
  };
  return (
    <Dialog
      title="타이머 추가"
      size="s"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: locked || draft.duration === undefined,
        title: draft.minutesReason ?? draft.secondsReason,
        onSelect: save,
      }}
    >
      <Properties>
        <TimerDurationFields
          minutes={minutes}
          seconds={seconds}
          onMinutesChange={setMinutes}
          onSecondsChange={setSeconds}
          disabled={locked}
        />
        <PropertyRow label="0 지나면">
          {({controlId}) => (
            <SegmentedControl
              id={controlId}
              label="0 지나면"
              fill
              disabled={locked}
              value={overrun ? 'continue' : 'stop'}
              onChange={value => setOverrun(value === 'continue')}
              options={[
                {value: 'continue', label: '계속'},
                {value: 'stop', label: '멈춤'},
              ]}
            />
          )}
        </PropertyRow>
      </Properties>
    </Dialog>
  );
}
