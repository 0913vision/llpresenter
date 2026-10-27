import {useState, type JSX} from 'react';
import {Dialog, Properties} from '@renderer/ui';
import {parseTimerDuration, TimerDurationFields} from './TimerDurationFields';
import {TimerOverrunField} from './TimerOverrunField';

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
        <TimerOverrunField
          value={overrun}
          onChange={setOverrun}
          disabled={locked}
        />
      </Properties>
    </Dialog>
  );
}
