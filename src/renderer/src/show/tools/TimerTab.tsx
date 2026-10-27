import {useState, type JSX} from 'react';
import {createTimerId} from '@shared/schema/ids';
import {MAX_TIMER_DEFINITIONS} from '@shared/schema/timers';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {IconButton} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {CountdownDialog} from './CountdownDialog';
import {saveNewCountdown, type NewCountdown} from './timerEdits';
import {useToolEditing} from './useToolEditing';
import {WindowedTimers} from './WindowedTimers';
import styles from './TimerTab.module.css';

function NewTimerDialog({
  locked,
  save,
  onClose,
}: {
  readonly locked: boolean;
  readonly save: (timer: NewCountdown) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [id] = useState(() => createTimerId(crypto.randomUUID()));
  return (
    <CountdownDialog
      locked={locked}
      onClose={onClose}
      onSave={fields => save({id, ...fields})}
    />
  );
}

export function TimerTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const api = window.llp;
  const document = useSettingsDocument('timers', '타이머', onProblem);
  const editing = useToolEditing({
    api,
    onProblem,
    write: saveNewCountdown,
    area: {key: 'timers', label: '타이머', log: 'Could not edit timers'},
  });
  const [adding, setAdding] = useState(false);
  const locked = editing.busy || document?.access !== 'editable';
  const reason =
    document === null
      ? '타이머를 불러오고 있습니다'
      : document.access !== 'editable'
        ? '타이머를 변경할 수 없습니다'
        : document.value.timers.length >= MAX_TIMER_DEFINITIONS
          ? '타이머가 가득 찼습니다'
          : undefined;
  return (
    <div className={styles.root}>
      <div className={styles.tools}>
        <IconButton
          icon="plus"
          label="타이머 추가"
          disabled={locked || reason !== undefined}
          title={reason}
          onClick={() => setAdding(true)}
        />
      </div>
      {api ? (
        <WindowedTimers api={api} timers={document?.value.timers ?? []} />
      ) : null}
      {adding ? (
        <NewTimerDialog
          locked={locked}
          save={editing.run}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}
