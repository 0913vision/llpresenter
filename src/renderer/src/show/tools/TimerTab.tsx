import {useEffect, useRef, useState, type JSX} from 'react';
import {createTimerId} from '@core/schema/ids';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import type {Timer} from '@core/schema/timers';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {AlertDialog, IconButton} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {TimerDialog} from './TimerDialog';
import {saveNewTimer, type NewTimer} from './timerEdits';
import {deleteTimer} from './timerDeletions';
import {useToolEditing} from './useToolEditing';
import {WindowedTimers} from './WindowedTimers';
import styles from './TimerTab.module.css';

function NewTimerDialog({
  locked,
  save,
  onClose,
}: {
  readonly locked: boolean;
  readonly save: (timer: NewTimer) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [id] = useState(() => createTimerId(crypto.randomUUID()));
  return (
    <TimerDialog
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
  const root = useRef<HTMLDivElement>(null);
  const editing = useToolEditing({
    api,
    onProblem,
    write: saveNewTimer,
    area: {key: 'timers', label: '타이머', log: 'Could not edit timers'},
  });
  const removal = useToolEditing({
    api,
    onProblem,
    write: deleteTimer,
    area: {key: 'timer-delete', label: '타이머', log: 'Could not delete timer'},
  });
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Timer | null>(null);
  const targetId = useRef<Timer['id'] | null>(null);
  const focusList = useRef(false);
  const locked =
    editing.busy || removal.busy || document?.access !== 'editable';
  useEffect(() => {
    if (!focusList.current || target !== null) return;
    focusList.current = false;
    root.current?.querySelector<HTMLElement>('[role="list"]')?.focus();
  }, [target]);
  const closeRemoval = (): void => {
    targetId.current = null;
    setTarget(null);
  };
  const reason =
    document === null
      ? '타이머를 불러오고 있습니다'
      : document.access !== 'editable'
        ? '타이머를 변경할 수 없습니다'
        : document.value.timers.length >= MAX_TIMER_DEFINITIONS
          ? '타이머가 가득 찼습니다'
          : undefined;
  return (
    <div className={styles.root} ref={root}>
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
        <WindowedTimers
          api={api}
          timers={document?.value.timers ?? []}
          editable={!locked}
          onProblem={onProblem}
          onRemove={timer => {
            targetId.current = timer.id;
            setTarget(timer);
          }}
        />
      ) : null}
      {adding ? (
        <NewTimerDialog
          locked={locked}
          save={editing.run}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {target ? (
        <AlertDialog
          icon="timer"
          title={`‘${target.name || '이름 없음'}’ 타이머를 삭제할까요?`}
          meta={['연결된 퀵 실행 항목도 삭제']}
          onCancel={closeRemoval}
          cancelLabel={removal.busy ? '닫기' : undefined}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked,
              onSelect: () => {
                if (locked) return;
                removal
                  .run({
                    type: 'timer.delete',
                    name: 'timers',
                    timerId: target.id,
                  })
                  .then(applied => {
                    if (applied && targetId.current === target.id) {
                      focusList.current = true;
                      closeRemoval();
                    }
                  })
                  .catch((cause: unknown) =>
                    console.error('Timer removal callback failed:', cause),
                  );
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
