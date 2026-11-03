import {RenameDialog} from '@renderer/ui/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {contextMenuTarget, openMenuFromKey} from '@renderer/ui/contextMenu';
import {useRef, useState, type JSX, type ReactNode} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createNoticeSetId} from '@core/schema/ids';
import type {NoticeSet} from '@core/schema/notices';
import {AlertDialog, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {MAX_NOTICE_SETS, type NoticeEdit} from './noticeEdits';
import {useDuplicateShortcut} from './useDuplicateShortcut';
import {namedToolMenuEntries, toolMenuReason} from './toolMenuEntries';

interface Editor {
  kind: 'rename' | 'delete';
  item: NoticeSet;
}

export function NoticeEditing({
  item,
  locked,
  full,
  save,
  onCopied,
  children,
}: {
  readonly item: NoticeSet | undefined;
  readonly locked: boolean;
  /** Whether the list holds as many 공지 세트 as it may. */
  readonly full: boolean;
  /** Selects the copy once it is saved. */
  readonly onCopied: (id: NoticeSet['id']) => void;
  readonly save: (
    edit: NoticeEdit,
    completion?: 'applied' | 'saved',
  ) => Promise<boolean>;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<{
    item: NoticeSet;
    anchor: MenuAnchor;
  } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const handoff = useMenuHandoff(menu !== null, setEditor);
  const revision = useRef(0);
  const close = (): void => {
    revision.current++;
    setEditor(null);
  };
  const duplicateReason = locked
    ? toolMenuReason(locked)
    : full
      ? limitReason('공지 세트', MAX_NOTICE_SETS)
      : undefined;
  const duplicate = (source: NoticeSet): void => {
    const copyId = createNoticeSetId(crypto.randomUUID());
    save({kind: 'duplicate', id: source.id, copyId}).then(
      saved => {
        if (saved) onCopied(copyId);
      },
      (cause: unknown) => console.error('Notice copy callback failed', cause),
    );
  };
  const area = useRef<HTMLDivElement>(null);
  useDuplicateShortcut({
    itemAt: event =>
      event.target instanceof Node && area.current?.contains(event.target)
        ? item
        : undefined,
    reason: duplicateReason,
    run: duplicate,
  });
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
        ref={area}
        onContextMenu={event => {
          if (!item) return;
          event.preventDefault();
          event.stopPropagation();
          setMenu({
            item,
            anchor: {
              kind: 'point',
              target: contextMenuTarget(event),
              point: {x: event.clientX, y: event.clientY},
            },
          });
        }}
        onKeyDown={event => {
          if (item) openMenuFromKey(event, anchor => setMenu({item, anchor}));
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
            rename: () => handoff({kind: 'rename', item: menu.item}),
            duplicate: () => duplicate(menu.item),
            duplicateReason,
            remove: () => setEditor({kind: 'delete', item: menu.item}),
          })}
        />
      ) : null}
      {editor?.kind === 'rename' ? (
        <RenameDialog
          key={editor.item.id}
          name={editor.item.name}
          title="공지 이름 바꾸기"
          locked={locked}
          maxLength={256}
          rename={{
            onClose: close,
            validate: name =>
              name.length > 256 ? '이름이 너무 깁니다' : undefined,
            onCommit: name =>
              save(
                {kind: 'update', id: editor.item.id, changes: {name}},
                'saved',
              ),
          }}
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
