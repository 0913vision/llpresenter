import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@shared/schema/song';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {isComposing} from '@renderer/ui/ime';
import {ArrangementDialog} from './ArrangementDialog';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
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
  readonly session: SongSession;
}): JSX.Element {
  const {busy} = useSyncExternalStore(store.subscribe, store.getSnapshot);
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
          ? {kind: 'point', point: {x: event.clientX, y: event.clientY}}
          : {kind: 'element', element: button},
    });
  };
  const menuLocked = locked || context?.name === undefined;
  const reason = busy
    ? '저장 중'
    : session.readOnly
      ? '읽기 전용 곡'
      : '기본 구성은 변경할 수 없습니다';
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
        <SelectMenu
          aria-label="구성"
          size="sm"
          options={options}
          value={value}
          onChange={select}
          disabled={busy}
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
      <IconButton
        icon="plus"
        size="sm"
        label="구성 추가"
        disabled={locked}
        title={locked ? reason : undefined}
        onClick={event => {
          const name = session.createArrangement();
          if (name !== undefined) {
            setRename({name, opener: event.currentTarget});
          }
        }}
      />
      {context === null ? null : (
        <Menu
          label="구성 관리"
          anchor={context.anchor}
          onClose={why => {
            if (why !== 'select') close(context.opener);
          }}
          entries={[
            {
              kind: 'item',
              id: 'rename',
              label: '이름 바꾸기',
              disabled: menuLocked,
              title: menuLocked ? reason : undefined,
              onSelect: () => {
                if (context.name !== undefined) {
                  setRename({name: context.name, opener: context.opener});
                }
                setContext(null);
              },
            },
            {kind: 'separator', id: 'separator'},
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              disabled: menuLocked,
              title: menuLocked ? reason : undefined,
              onSelect: () => {
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
            },
          ]}
        />
      )}
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
