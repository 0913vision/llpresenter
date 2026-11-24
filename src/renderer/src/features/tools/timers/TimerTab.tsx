import {PanelAction} from '@renderer/ui/panels/PanelActionSlot';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {limitReason} from '@core/common/limitReason';
import {useRef, useState, type JSX} from 'react';
import {createTimerId} from '@core/schema/ids';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/timers';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {IconButton} from '@renderer/ui';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import type {Notice} from '@renderer/ui/popups/notices';
import {TimerDialog} from './TimerDialog';
import {deleteTimer, saveNewTimer, type NewTimer} from './timerEdits';
import {useToolEditing} from '../useToolEditing';
import {useUndoKeys} from '@renderer/platform/useUndoKeys';
import {focusHistorySurface} from '@renderer/ui/lists/focusHistorySurface';
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
    area: {
      key: 'timer-delete',
      label: '타이머',
      log: 'Could not delete timer',
      history: 'timers',
    },
  });
  useUndoKeys(root);
  const [adding, setAdding] = useState(false);
  const locked =
    editing.busy || removal.busy || document?.access !== 'editable';
  const reason =
    document === null
      ? '타이머 불러오는 중'
      : document.access !== 'editable'
        ? NEWER_FILE_REASON
        : document.value.timers.length >= MAX_TIMER_DEFINITIONS
          ? limitReason('타이머', MAX_TIMER_DEFINITIONS)
          : undefined;
  return (
    <div className={styles.root} ref={root}>
      <PanelAction>
        <IconButton
          icon="plus"
          label="타이머 추가"
          disabled={locked || reason !== undefined}
          title={reason}
          onClick={() => setAdding(true)}
        />
      </PanelAction>
      {api ? (
        <WindowedTimers
          api={api}
          timers={document?.value.timers ?? []}
          editable={!locked}
          copyReason={
            (document?.value.timers.length ?? 0) >= MAX_TIMER_DEFINITIONS
              ? limitReason('타이머', MAX_TIMER_DEFINITIONS)
              : undefined
          }
          onProblem={onProblem}
          onRemove={timer => {
            deleteSelection(
              1,
              () =>
                !locked &&
                document.value.timers.some(row => row.id === timer.id),
              () => {
                focusHistorySurface(root.current);
                removal
                  .run({
                    type: 'timer.delete',
                    name: 'timers',
                    timerId: timer.id,
                  })
                  .catch((cause: unknown) =>
                    console.error('Timer removal callback failed:', cause),
                  );
              },
            );
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
    </div>
  );
}
