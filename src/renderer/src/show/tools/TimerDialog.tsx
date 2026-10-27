import {useState, type JSX} from 'react';
import {
  Dialog,
  Properties,
  PropertyRow,
  SelectMenu,
  TextField,
} from '@renderer/ui';
import {parseTimerDuration, TimerDurationFields} from './TimerDurationFields';
import {TimerOverrunField} from './TimerOverrunField';
import {
  localDateText,
  timerDateReason,
  timerTimeReason,
  type TimerConfiguration,
} from './timerConfiguration';

const KINDS = [
  {value: 'countdown', label: '카운트다운'},
  {value: 'countdownTo', label: '날짜와 시각'},
  {value: 'elapsed', label: '경과'},
  {value: 'clock', label: '시계'},
] as const;

export function TimerDialog({
  locked,
  onSave,
  onClose,
}: {
  readonly locked: boolean;
  readonly onSave: (fields: TimerConfiguration) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [kind, setKind] = useState<TimerConfiguration['kind']>('countdown');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [overrun, setOverrun] = useState(true);
  const [date, setDate] = useState(() => localDateText(new Date()));
  const [time, setTime] = useState('12:00');
  const duration = parseTimerDuration(
    minutes,
    seconds,
    kind === 'elapsed' ? 0 : 1,
  );
  const dateReason = timerDateReason(date);
  const timeReason = timerTimeReason(time);
  const configuration = (): TimerConfiguration | undefined => {
    switch (kind) {
      case 'clock':
        return {kind};
      case 'countdownTo':
        return dateReason || timeReason
          ? undefined
          : {kind, date, time, overrun};
      case 'countdown':
        return duration.duration === undefined
          ? undefined
          : {kind, duration: duration.duration, overrun};
      case 'elapsed':
        return duration.duration === undefined
          ? undefined
          : {kind, start: duration.duration};
    }
  };
  const fields = configuration();
  const reason =
    kind === 'countdownTo'
      ? (dateReason ?? timeReason)
      : kind === 'clock'
        ? undefined
        : (duration.minutesReason ?? duration.secondsReason);
  const save = (): void => {
    if (locked || !fields) return;
    onSave(fields)
      .then(saved => {
        if (saved) onClose();
      })
      .catch((cause: unknown) =>
        console.error('Timer save callback failed:', cause),
      );
  };
  return (
    <Dialog
      title="타이머 추가"
      size="s"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: locked || fields === undefined,
        title: reason,
        onSelect: save,
      }}
    >
      <Properties>
        <PropertyRow label="종류">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              aria-label="타이머 종류"
              block
              disabled={locked}
              value={kind}
              onChange={setKind}
              options={KINDS}
            />
          )}
        </PropertyRow>
        {kind === 'countdown' || kind === 'elapsed' ? (
          <TimerDurationFields
            minutes={minutes}
            seconds={seconds}
            onMinutesChange={setMinutes}
            onSecondsChange={setSeconds}
            disabled={locked}
            minimum={kind === 'elapsed' ? 0 : 1}
          />
        ) : null}
        {kind === 'countdownTo' ? (
          <>
            <PropertyRow label="날짜">
              {({controlId}) => (
                <TextField
                  id={controlId}
                  aria-label="날짜"
                  block
                  value={date}
                  onChange={setDate}
                  maxLength={10}
                  placeholder="YYYY-MM-DD"
                  readOnly={locked}
                  invalid={dateReason !== undefined}
                  invalidReason={dateReason}
                />
              )}
            </PropertyRow>
            <PropertyRow label="시각">
              {({controlId}) => (
                <TextField
                  id={controlId}
                  aria-label="시각"
                  block
                  value={time}
                  onChange={setTime}
                  maxLength={5}
                  placeholder="HH:mm"
                  readOnly={locked}
                  invalid={timeReason !== undefined}
                  invalidReason={timeReason}
                />
              )}
            </PropertyRow>
          </>
        ) : null}
        {kind === 'countdown' || kind === 'countdownTo' ? (
          <TimerOverrunField
            value={overrun}
            onChange={setOverrun}
            disabled={locked}
          />
        ) : null}
      </Properties>
    </Dialog>
  );
}
