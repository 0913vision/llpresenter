import {RenameDialog} from '@renderer/ui/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {contextMenuTarget, openMenuFromKey} from '@renderer/ui/contextMenu';
import {useRef, useState, type JSX, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/timers';
import {TIMER_NAME_LIMIT} from '@core/schema/quickTimerEdit';
import {Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {createTimerId} from '@core/schema/ids';
import {duplicateTimer, renameTimer} from './timerEdits';
import {useDuplicateShortcut} from './useDuplicateShortcut';
import {useTimerEditDialog} from './useTimerEditDialog';
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
  return (
    <RenameDialog
      name={timer.name}
      title="타이머 이름 바꾸기"
      locked={locked}
      maxLength={TIMER_NAME_LIMIT}
      rename={{
        onCommit: save,
        onClose: onClose,
        validate: name =>
          name.length > TIMER_NAME_LIMIT ? '이름이 너무 깁니다' : undefined,
      }}
    />
  );
}

export function TimerRowMenu({
  api,
  timer,
  editable,
  copyReason,
  onProblem,
  onRemove,
  children,
}: {
  readonly api: LlpApi;
  readonly timer: Timer;
  readonly editable: boolean;
  /** Why 복제 can't run apart from a lock, such as a full list. */
  readonly copyReason?: string | undefined;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onRemove: ((timer: Timer) => void) | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [renaming, setRenaming] = useState(false);
  const renameAfterMenu = useMenuHandoff(menu !== null, () =>
    setRenaming(true),
  );
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
  const copying = useToolEditing({
    api,
    onProblem,
    write: duplicateTimer,
    area: {
      key: 'timer-copy',
      label: '타이머 복제',
      log: 'Could not copy timer',
    },
  });
  const locked = !editable || editing.busy;
  const change = useTimerEditDialog({
    api,
    timer,
    menuOpen: menu !== null,
    locked,
    onProblem,
  });
  const duplicateReason = !editable
    ? toolMenuReason(true)
    : editing.busy || copying.busy
      ? toolMenuReason(true, true)
      : copyReason;
  const duplicate = (): void => {
    copying
      .run({id: timer.id, copyId: createTimerId(crypto.randomUUID())})
      .catch((cause: unknown) =>
        console.error('Timer copy callback failed:', cause),
      );
  };
  const row = useRef<HTMLElement>(null);
  useDuplicateShortcut({
    itemAt: event =>
      event.target instanceof Node && row.current?.contains(event.target)
        ? timer
        : undefined,
    reason: duplicateReason,
    run: duplicate,
  });
  return (
    <section
      ref={row}
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
        openMenuFromKey(event, setMenu);
      }}
    >
      {children}
      {menu ? (
        <Menu
          context
          label="타이머"
          anchor={menu}
          onClose={() => setMenu(null)}
          entries={namedToolMenuEntries({
            reason: toolMenuReason(locked, editing.busy),
            edit: change.open,
            rename: () => renameAfterMenu(true),
            duplicate,
            duplicateReason,
            remove: onRemove ? () => onRemove(timer) : undefined,
          })}
        />
      ) : null}
      {change.dialog}
      {renaming ? (
        <TimerNameDialog
          timer={timer}
          locked={locked}
          onClose={() => setRenaming(false)}
          save={timerName =>
            editing.run(
              {
                type: 'timer.rename',
                name: 'timers',
                timerId: timer.id,
                timerName,
              },
              'saved',
            )
          }
        />
      ) : null}
    </section>
  );
}
