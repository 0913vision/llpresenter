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
import type {TimerEditDraft} from './timerEditDraft';

const KINDS = [
  {value: 'countdown', label: '카운트다운'},
  {value: 'countdownTo', label: '날짜와 시각'},
  {value: 'elapsed', label: '경과'},
  {value: 'clock', label: '시계'},
] as const;
const LEGACY_KINDS = [
  ...KINDS,
  {value: 'elapsedFrom', label: '시각 경과'},
] as const;
const SECONDS_PER_MINUTE = 60;

function initialDuration(initial: TimerEditDraft | undefined): number {
  if (initial?.kind === 'countdown') return initial.duration;
  if (initial?.kind === 'elapsed') return initial.start;
  return 0;
}

type TimerDialogProps = {
  readonly locked: boolean;
  readonly onClose: () => void;
} & (
  | {
      readonly initial?: undefined;
      readonly onSave: (fields: TimerConfiguration) => Promise<boolean>;
    }
  | {
      readonly initial: TimerEditDraft;
      readonly onSave: (fields: TimerEditDraft) => Promise<boolean>;
    }
);

export function TimerDialog(props: TimerDialogProps): JSX.Element {
  const {initial, locked, onClose} = props;
  const [kind, setKind] = useState<TimerEditDraft['kind']>(
    initial?.kind ?? 'countdown',
  );
  const [minutes, setMinutes] = useState(() =>
    String(Math.floor(initialDuration(initial) / SECONDS_PER_MINUTE)),
  );
  const [seconds, setSeconds] = useState(() =>
    String(initialDuration(initial) % SECONDS_PER_MINUTE),
  );
  const [overrun, setOverrun] = useState(
    initial?.kind === 'countdown' || initial?.kind === 'countdownTo'
      ? initial.overrun
      : true,
  );
  const [date, setDate] = useState(() =>
    initial?.kind === 'countdownTo' ? initial.date : localDateText(new Date()),
  );
  const [time, setTime] = useState(
    initial?.kind === 'countdownTo' || initial?.kind === 'elapsedFrom'
      ? initial.time
      : '12:00',
  );
  const duration = parseTimerDuration(
    minutes,
    seconds,
    kind === 'elapsed' ? 0 : 1,
  );
  const dateReason = timerDateReason(date);
  const timeReason = timerTimeReason(time);
  const configuration = (): TimerEditDraft | undefined => {
    switch (kind) {
      case 'clock':
        return {kind};
      case 'countdownTo':
        return dateReason || timeReason
          ? undefined
          : {kind, date, time, overrun};
      case 'elapsedFrom':
        return timeReason ? undefined : {kind, time};
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
      : kind === 'elapsedFrom'
        ? timeReason
        : kind === 'clock'
          ? undefined
          : (duration.minutesReason ?? duration.secondsReason);
  const save = (): void => {
    if (locked || !fields) return;
    let saving: Promise<boolean>;
    if (props.initial === undefined) {
      if (fields.kind === 'elapsedFrom') return;
      saving = props.onSave(fields);
    } else {
      saving = props.onSave(fields);
    }
    saving
      .then(saved => {
        if (saved) onClose();
      })
      .catch((cause: unknown) =>
        console.error('Timer save callback failed:', cause),
      );
  };
  return (
    <Dialog
      title={initial ? '타이머 수정' : '타이머 추가'}
      size="s"
      onCancel={onClose}
      primary={{
        label: initial ? '저장' : '추가',
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
              options={initial?.kind === 'elapsedFrom' ? LEGACY_KINDS : KINDS}
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
        ) : null}
        {kind === 'countdownTo' || kind === 'elapsedFrom' ? (
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
