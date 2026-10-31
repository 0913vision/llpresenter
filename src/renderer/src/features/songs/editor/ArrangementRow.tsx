import {useRef, useSyncExternalStore, type JSX} from 'react';
import type {AnySong} from '@core/schema/groupedSong';
import {ArrangementPicker} from './ArrangementPicker';
import {NewArrangementDialog} from './NewArrangementDialog';
import {SongArrangementStrip} from './SongArrangementStrip';
import {ArrangementDialog} from './ArrangementDialog';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './ArrangementRow.module.css';

/** Selects an order and manages its main-owned name and service references. */
export function ArrangementRow({
  store,
  session,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession<AnySong>;
}): JSX.Element {
  const {busy, labels, actionRequest} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const row = useRef<HTMLDivElement>(null);
  const names =
    session.history.snapshot.song.arrangements?.map(item => item.name) ?? [];
  const locked = busy || session.readOnly;
  const reason = busy
    ? '저장 중'
    : session.readOnly
      ? '읽기 전용 곡'
      : undefined;
  const close = (): void => {
    store.requestAction(null);
    row.current
      ?.querySelector<HTMLElement>('button[aria-label="구성"]')
      ?.focus();
  };
  return (
    <div ref={row} className={styles.row}>
      <span className={styles.label}>구성</span>
      <ArrangementPicker
        names={names}
        selected={session.arrangement}
        disabled={busy}
        createReason={reason}
        manageReason={reason}
        choose={name => {
          store.requestAction(null);
          session.selectArrangement(name);
        }}
        create={() => store.requestAction('create-arrangement')}
        rename={() => store.requestAction('rename-arrangement')}
        remove={() => {
          if (session.arrangement !== undefined) {
            editorTask(store.deleteArrangement(session.arrangement));
          }
        }}
        edit={() => store.requestAction('edit-arrangement')}
      />
      {actionRequest?.action === 'edit-arrangement' ? (
        <SongArrangementStrip
          key={actionRequest.serial}
          session={session}
          labels={labels?.value.labels ?? []}
          locked={locked}
        />
      ) : null}
      {actionRequest?.action === 'create-arrangement' ? (
        <NewArrangementDialog
          names={names}
          locked={locked}
          create={name =>
            Promise.resolve(session.createArrangement(name) !== undefined)
          }
          onClose={close}
        />
      ) : null}
      {actionRequest?.action === 'rename-arrangement' &&
      actionRequest.arrangement !== undefined ? (
        <ArrangementDialog
          key={actionRequest.serial}
          name={actionRequest.arrangement}
          names={names}
          store={store}
          locked={locked}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
