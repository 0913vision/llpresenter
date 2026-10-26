import {useState, type JSX} from 'react';
import {createQuickItemId, createTimerId} from '@shared/schema/ids';
import {Dialog, Properties, PropertyRow, SegmentedControl} from '@renderer/ui';
import {
  parseTimerDuration,
  TimerDurationFields,
} from '../tools/TimerDurationFields';
import type {QuickEdit} from './quickEdits';

export function QuickTimerDialog({
  locked,
  save,
  onClose,
}: {
  readonly locked: boolean;
  readonly save: (edit: QuickEdit) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [overrun, setOverrun] = useState(true);
  const [ids] = useState(() => ({
    quickItemId: createQuickItemId(crypto.randomUUID()),
    timerId: createTimerId(crypto.randomUUID()),
  }));
  const draft = parseTimerDuration(minutes, seconds);
  const saveTimer = (): void => {
    if (locked || draft.duration === undefined) return;
    save({kind: 'timer-add', ...ids, duration: draft.duration, overrun})
      .then(saved => {
        if (saved) onClose();
      })
      .catch((cause: unknown) =>
        console.error('Quick timer add callback failed:', cause),
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
        onSelect: saveTimer,
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
              aria-label="0 지나면"
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
