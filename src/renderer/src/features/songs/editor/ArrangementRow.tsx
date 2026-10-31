import {contextMenuTarget} from '@renderer/ui/contextMenu';
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {ArrangementPicker} from './ArrangementPicker';
import {NewArrangementDialog} from './NewArrangementDialog';
import {SongArrangementStrip} from './SongArrangementStrip';
import {arrangementManagementEntries} from './arrangementMenuEntries';
import {isComposing} from '@renderer/ui/ime';
import {ArrangementDialog} from './ArrangementDialog';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import type {AnySong} from '@core/schema/groupedSong';
import styles from './ArrangementRow.module.css';

const MAX_SEGMENTS = 5;
interface Context {
  readonly name: string | undefined;
  readonly anchor: MenuAnchor;
  readonly opener: HTMLElement;
}

/** Selects an order and manages its main-owned name and service references. */
export function ArrangementRow({
  store,
  session,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession<AnySong>;
}): JSX.Element {
  const {busy, labels} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const [restore, setRestore] = useState<{target: HTMLElement} | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [rename, setRename] = useState<{
    name: string;
    opener: HTMLElement;
  } | null>(null);
  const names =
    session.history.snapshot.song.arrangements?.map(item => item.name) ?? [];
  const options = [DEFAULT_ARRANGEMENT_NAME, ...names].map(value => ({
    value,
    label: value,
  }));
  const value = session.arrangement ?? DEFAULT_ARRANGEMENT_NAME;
  const locked = busy || session.readOnly;
  useLayoutEffect(() => {
    const target = restore?.target;
    if (target === undefined) return;
    (target.isConnected
      ? target
      : row.current?.querySelector<HTMLElement>(
          '[aria-checked="true"], button[aria-haspopup="listbox"], button',
        )
    )?.focus();
  }, [restore]);
  const select = (name: string): void =>
    session.selectArrangement(
      name === DEFAULT_ARRANGEMENT_NAME ? undefined : name,
    );
  const close = (opener: HTMLElement): void => {
    setRestore({target: opener});
    setContext(null);
    setRename(null);
  };
  const manage = (
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>,
  ): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button')
        : null;
    if (button === null || !row.current?.contains(button)) return;
    const radios = [...row.current.querySelectorAll('[role="radio"]')];
    const name =
      options.length > MAX_SEGMENTS &&
      button.matches('[aria-haspopup="listbox"]')
        ? value
        : options[radios.indexOf(button)]?.value;
    if (name === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setContext({
      name: name === DEFAULT_ARRANGEMENT_NAME ? undefined : name,
      opener: button,
      anchor:
        'clientX' in event
          ? {
              kind: 'point',
              target: contextMenuTarget(event),
              point: {x: event.clientX, y: event.clientY},
            }
          : {
              kind: 'element',
              target: contextMenuTarget(event),
              element: button,
            },
    });
  };
  const menuLocked = locked || context?.name === undefined;
  const reason = busy
    ? '저장 중'
    : session.readOnly
      ? '읽기 전용 곡'
      : '기본 구성은 바꿀 수 없습니다';
  return (
    <div
      ref={row}
      className={styles.row}
      onContextMenu={manage}
      onKeyDown={event => {
        if (
          !isComposing(event) &&
          (event.key === 'ContextMenu' ||
            (event.key === 'F10' && event.shiftKey))
        ) {
          manage(event);
        }
      }}
    >
      <span className={styles.label}>구성</span>
      {options.length > MAX_SEGMENTS ? (
        <ArrangementPicker
          names={names}
          selected={session.arrangement}
          disabled={busy}
          createReason={locked ? reason : undefined}
          choose={name => session.selectArrangement(name)}
          create={() => setCreating(true)}
          edit={() => setEditing(value => value + 1)}
        />
      ) : (
        <SegmentedControl
          label="구성"
          options={options}
          value={value}
          onChange={select}
          disabled={busy}
        />
      )}
      {options.length <= MAX_SEGMENTS ? (
        <IconButton
          icon="edit"
          size="sm"
          label="구성 편집…"
          disabled={busy}
          onClick={() => setEditing(value => value + 1)}
        />
      ) : null}
      <IconButton
        icon="plus"
        size="sm"
        label="구성 추가"
        disabled={locked}
        title={locked ? reason : undefined}
        onClick={() => setCreating(true)}
      />
      {context === null ? null : (
        <Menu
          label="구성 관리"
          anchor={context.anchor}
          onClose={why => {
            if (why !== 'select') close(context.opener);
          }}
          entries={arrangementManagementEntries({
            reason: menuLocked ? reason : undefined,
            rename: () => {
              if (context.name !== undefined) {
                setRename({name: context.name, opener: context.opener});
              }
              setContext(null);
            },
            remove: () => {
              setContext(null);
              editorTask(
                (async () => {
                  if (context.name !== undefined) {
                    await store.deleteArrangement(context.name);
                  }
                  close(context.opener);
                })(),
              );
            },
          })}
        />
      )}
      {editing ? (
        <SongArrangementStrip
          key={editing}
          session={session}
          labels={labels?.value.labels ?? []}
          locked={locked}
        />
      ) : null}
      {creating ? (
        <NewArrangementDialog
          names={names}
          locked={locked}
          create={name =>
            Promise.resolve(session.createArrangement(name) !== undefined)
          }
          onClose={() => {
            setCreating(false);
            const opener = row.current?.querySelector<HTMLElement>(
              'button[aria-label="구성"], button[aria-label="구성 추가"]',
            );
            if (opener) setRestore({target: opener});
          }}
        />
      ) : null}
      {rename === null ? null : (
        <ArrangementDialog
          key={rename.name}
          name={rename.name}
          names={names}
          store={store}
          locked={locked}
          onClose={() => close(rename.opener)}
        />
      )}
    </div>
  );
}
