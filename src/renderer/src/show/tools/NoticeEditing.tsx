import {useRef, useState, type JSX, type ReactNode} from 'react';
import type {NoticeSet} from '@shared/schema/notices';
import {AlertDialog, Dialog, Menu, TextField} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {NoticeEdit} from './noticeEdits';
import {namedToolMenuEntries, toolMenuReason} from './toolMenuEntries';

interface Editor {
  kind: 'rename' | 'delete';
  item: NoticeSet;
}

function RenameDialog({
  item,
  locked,
  close,
  save,
}: {
  readonly item: NoticeSet;
  readonly locked: boolean;
  readonly close: () => void;
  readonly save: (name: string) => void;
}): JSX.Element {
  const [name, setName] = useState(item.name);
  const reason =
    name.trim() === ''
      ? '이름을 입력하세요'
      : name.trim().length > 256
        ? '이름이 너무 깁니다'
        : undefined;
  return (
    <Dialog
      title="공지 이름 바꾸기"
      size="s"
      onCancel={close}
      primary={{
        label: '저장',
        disabled: locked || reason !== undefined,
        title: reason,
        onSelect: () => save(name),
      }}
    >
      <TextField
        aria-label="이름"
        autoFocus
        block
        value={name}
        maxLength={256}
        onChange={setName}
        readOnly={locked}
        invalid={reason !== undefined}
        invalidReason={reason}
      />
    </Dialog>
  );
}

export function NoticeEditing({
  item,
  locked,
  save,
  children,
}: {
  readonly item: NoticeSet | undefined;
  readonly locked: boolean;
  readonly save: (edit: NoticeEdit) => Promise<boolean>;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<{
    item: NoticeSet;
    anchor: MenuAnchor;
  } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const revision = useRef(0);
  const close = (): void => {
    revision.current++;
    setEditor(null);
  };
  const commit = (edit: NoticeEdit): void => {
    const started = revision.current;
    save(edit).then(
      saved => {
        if (saved && revision.current === started) close();
      },
      (cause: unknown) => console.error('Notice edit callback failed', cause),
    );
  };
  return (
    <>
      <div
        onContextMenu={event => {
          if (!item) return;
          event.preventDefault();
          event.stopPropagation();
          setMenu({
            item,
            anchor: {
              kind: 'point',
              point: {x: event.clientX, y: event.clientY},
            },
          });
        }}
        onKeyDown={event => {
          if (
            !item ||
            !(
              event.key === 'ContextMenu' ||
              (event.shiftKey && event.key === 'F10')
            )
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setMenu({
            item,
            anchor: {kind: 'element', element: event.currentTarget},
          });
        }}
      >
        {children}
      </div>
      {menu ? (
        <Menu
          label="공지 세트"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={namedToolMenuEntries({
            reason: toolMenuReason(locked),
            rename: () => setEditor({kind: 'rename', item: menu.item}),
            remove: () => setEditor({kind: 'delete', item: menu.item}),
          })}
        />
      ) : null}
      {editor?.kind === 'rename' ? (
        <RenameDialog
          key={editor.item.id}
          item={editor.item}
          locked={locked}
          close={close}
          save={name =>
            commit({kind: 'update', id: editor.item.id, changes: {name}})
          }
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="warning"
          title={`‘${editor.item.name}’ 공지를 삭제할까요?`}
          onCancel={close}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked,
              onSelect: () => commit({kind: 'delete', id: editor.item.id}),
            },
          ]}
        />
      ) : null}
    </>
  );
}
