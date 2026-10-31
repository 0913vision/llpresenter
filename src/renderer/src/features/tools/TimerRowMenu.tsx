import {contextMenuTarget} from '@renderer/ui/contextMenu';
import {useState, type JSX, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/timers';
import {TIMER_NAME_LIMIT} from '@core/schema/quickTimerEdit';
import {Dialog, TextField, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {renameTimer} from './timerRenames';
import {useToolEditing} from './useToolEditing';
import styles from './TimerTab.module.css';
import {namedToolMenuEntries, toolMenuReason} from './toolMenuEntries';

function TimerNameDialog({
  timer,
  locked,
  save,
  onClose,
}: {
  readonly timer: Timer;
  readonly locked: boolean;
  readonly save: (name: string) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(timer.name);
  const trimmed = name.trim();
  const reason =
    trimmed === ''
      ? '이름을 적어 주세요'
      : trimmed.length > TIMER_NAME_LIMIT
        ? '이름이 너무 깁니다'
        : undefined;
  return (
    <Dialog
      title="타이머 이름 바꾸기"
      size="s"
      onCancel={onClose}
      primary={{
        label: '저장',
        disabled: locked || reason !== undefined || trimmed === timer.name,
        title: reason,
        onSelect: () => {
          if (locked || reason !== undefined || trimmed === timer.name) return;
          save(trimmed)
            .then(saved => {
              if (saved) onClose();
            })
            .catch((cause: unknown) =>
              console.error('Timer rename callback failed:', cause),
            );
        },
      }}
    >
      <TextField
        aria-label="이름"
        autoFocus
        block
        value={name}
        onChange={setName}
        maxLength={TIMER_NAME_LIMIT}
        readOnly={locked}
        invalid={reason !== undefined}
        invalidReason={reason}
        onFocus={event => event.currentTarget.select()}
      />
    </Dialog>
  );
}

export function TimerRowMenu({
  api,
  timer,
  editable,
  onProblem,
  onRemove,
  children,
}: {
  readonly api: LlpApi;
  readonly timer: Timer;
  readonly editable: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onRemove: ((timer: Timer) => void) | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [renaming, setRenaming] = useState(false);
  const editing = useToolEditing({
    api,
    onProblem,
    write: renameTimer,
    area: {
      key: 'timer-name',
      label: '타이머 이름',
      log: 'Could not rename timer',
    },
  });
  const locked = !editable || editing.busy;
  return (
    <section
      className={styles.row}
      role="group"
      aria-label={timer.name || '이름 없음'}
      tabIndex={-1}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        setMenu({
          kind: 'point',
          target: contextMenuTarget(event),
          point: {x: event.clientX, y: event.clientY},
        });
      }}
      onKeyDown={event => {
        if (!(
          event.key === 'ContextMenu' ||
          (event.shiftKey && event.key === 'F10')
        )) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setMenu({
          kind: 'element',
          target: contextMenuTarget(event),
          element: event.currentTarget,
        });
      }}
    >
      {children}
      {menu ? (
        <Menu
          label="타이머"
          anchor={menu}
          onClose={() => setMenu(null)}
          entries={namedToolMenuEntries({
            reason: toolMenuReason(locked, editing.busy),
            rename: () => setRenaming(true),
            remove: onRemove ? () => onRemove(timer) : undefined,
          })}
        />
      ) : null}
      {renaming ? (
        <TimerNameDialog
          timer={timer}
          locked={locked}
          onClose={() => setRenaming(false)}
          save={timerName =>
            editing.run({
              type: 'timer.rename',
              name: 'timers',
              timerId: timer.id,
              timerName,
            })
          }
        />
      ) : null}
    </section>
  );
}
