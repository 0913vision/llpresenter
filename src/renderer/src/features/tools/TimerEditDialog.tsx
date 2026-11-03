import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/timers';
import {localDateText} from '@core/timers/timerConfiguration';
import {timerEditDraft} from '@core/timers/timerEditDraft';
import type {Notice} from '@renderer/ui/notices';
import {TimerDialog} from './TimerDialog';
import {saveTimerEdit} from './timerEdits';
import {useToolEditing} from './useToolEditing';

/** 타이머 수정 for one saved 타이머: 저장 keeps its id, so every use stays linked. */
export function TimerEditDialog({
  api,
  timer,
  locked,
  onProblem,
  onClose,
}: {
  readonly api: LlpApi;
  readonly timer: Timer;
  readonly locked: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onClose: () => void;
}): JSX.Element {
  const editing = useToolEditing({
    api,
    onProblem,
    write: saveTimerEdit,
    area: {
      key: 'timer-edit',
      label: '타이머',
      log: 'Could not edit timer',
    },
  });
  return (
    <TimerDialog
      locked={locked || editing.busy}
      initial={timerEditDraft(timer, localDateText(new Date()))}
      onClose={onClose}
      onSave={draft => editing.run({id: timer.id, draft}, 'saved')}
    />
  );
}
