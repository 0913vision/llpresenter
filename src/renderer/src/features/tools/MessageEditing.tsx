import {contextMenuTarget, isContextMenuKey} from '@renderer/ui/contextMenu';
import {useState, type JSX, type ReactNode} from 'react';
import type {MessageTemplate} from '@core/schema/messages';
import {MAX_MESSAGE_CHARACTERS} from '@core/overlays/messageText';
import type {NamedDocument} from '@renderer/platform/useSettingsDocument';
import {
  AlertDialog,
  Dialog,
  IconButton,
  Menu,
  Properties,
  PropertyRow,
  TextArea,
  TextField,
} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {useToolEditing} from './useToolEditing';
import {
  MAX_MESSAGE_TEMPLATES,
  MESSAGE_NAME_LIMIT,
  messageNameReason,
  messageTextReason,
  newMessageTemplate,
  saveMessageEdit,
  type MessageFields,
  type MessageEdit,
} from './messageEdits';
import styles from './MessageTab.module.css';
import {messageMenuEntries, toolMenuReason} from './toolMenuEntries';

type Editor =
  | {readonly kind: 'add'}
  | {readonly kind: 'edit'; readonly item: MessageTemplate}
  | {readonly kind: 'delete'; readonly item: MessageTemplate};

function TemplateDialog({
  editor,
  locked,
  onCancel,
  onSave,
}: {
  readonly editor: Exclude<Editor, {kind: 'delete'}>;
  readonly locked: boolean;
  readonly onCancel: () => void;
  readonly onSave: (fields: MessageFields) => void;
}): JSX.Element {
  const [name, setName] = useState(
    editor.kind === 'add' ? '' : editor.item.name,
  );
  const [text, setText] = useState(
    editor.kind === 'add' ? '' : editor.item.text,
  );
  const nameReason = messageNameReason(name);
  const textReason = messageTextReason(text);
  return (
    <Dialog
      title={
        editor.kind === 'add' ? '메시지 템플릿 추가' : '메시지 템플릿 수정'
      }
      size="s"
      onCancel={onCancel}
      primary={{
        label: editor.kind === 'add' ? '추가' : '저장',
        disabled:
          locked || nameReason !== undefined || textReason !== undefined,
        title: nameReason ?? textReason,
        onSelect: () => onSave({name, text}),
      }}
    >
      <Properties placement="window">
        <PropertyRow label="이름">
          {({controlId}) => (
            <TextField
              id={controlId}
              block
              value={name}
              onChange={setName}
              maxLength={MESSAGE_NAME_LIMIT}
              readOnly={locked}
              invalid={nameReason !== undefined}
              invalidReason={nameReason}
            />
          )}
        </PropertyRow>
        <PropertyRow label="문장" alignTop>
          {({controlId}) => (
            <TextArea
              id={controlId}
              value={text}
              onChange={setText}
              maxLength={MAX_MESSAGE_CHARACTERS}
              readOnly={locked}
              invalid={textReason !== undefined}
              invalidReason={textReason}
            />
          )}
        </PropertyRow>
      </Properties>
    </Dialog>
  );
}

export function MessageEditing({
  document,
  onProblem,
  onSelect,
  children,
}: {
  readonly document: NamedDocument<'messages'> | null;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onSelect: (id: string) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<{
    anchor: MenuAnchor;
    item: MessageTemplate;
  } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveMessageEdit,
    onProblem,
    area: {
      key: 'messages',
      label: '메시지 템플릿',
      log: 'Could not edit message templates',
    },
  });
  const locked =
    document?.access !== 'editable' || window.llp === undefined || busy;
  const full = (document?.value.templates.length ?? 0) >= MAX_MESSAGE_TEMPLATES;
  const openMenu = (target: EventTarget, anchor: MenuAnchor): boolean => {
    if (!(target instanceof Element)) return false;
    const id = target.closest<HTMLElement>('[role="option"]')?.dataset['value'];
    const item = document?.value.templates.find(item => item.id === id);
    if (item === undefined) return false;
    setMenu({anchor, item});
    return true;
  };
  const save = (edit: MessageEdit): void => {
    run(edit).then(
      saved => {
        if (!saved) return;
        setEditor(null);
        if (edit.kind === 'add') onSelect(edit.item.id);
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Message edit callback failed',
          detail: String(cause),
        }),
    );
  };
  return (
    <>
      <div className={styles.editingTools}>
        <IconButton
          icon="plus"
          label="메시지 템플릿 추가"
          disabled={locked || full}
          title={full ? '메시지 템플릿이 가득 찼습니다' : undefined}
          onClick={() => setEditor({kind: 'add'})}
        />
      </div>
      <div
        onContextMenu={event => {
          if (
            openMenu(event.target, {
              kind: 'point',
              target: contextMenuTarget(event),
              point: {x: event.clientX, y: event.clientY},
            })
          ) {
            event.preventDefault();
          }
        }}
        onKeyDown={event => {
          if (
            isContextMenuKey(event) &&
            openMenu(event.target, {
              kind: 'element',
              target: contextMenuTarget(event),
              element:
                event.target instanceof HTMLElement
                  ? event.target
                  : event.currentTarget,
            })
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
      {menu ? (
        <Menu
          label="메시지 템플릿"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={messageMenuEntries({
            reason: toolMenuReason(locked, busy),
            edit: () => setEditor({kind: 'edit', item: menu.item}),
            remove: () => setEditor({kind: 'delete', item: menu.item}),
          })}
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="msg"
          title={`‘${editor.item.name}’ 메시지 템플릿을 삭제할까요?`}
          onCancel={() => setEditor(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked,
              onSelect: () => {
                save({kind: 'delete', id: editor.item.id});
              },
            },
          ]}
        />
      ) : editor ? (
        <TemplateDialog
          editor={editor}
          locked={locked}
          onCancel={() => setEditor(null)}
          onSave={fields => {
            save(
              editor.kind === 'add'
                ? {kind: 'add', item: newMessageTemplate(fields)}
                : {kind: 'update', id: editor.item.id, fields},
            );
          }}
        />
      ) : null}
    </>
  );
}
