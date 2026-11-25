import {logFailure} from '@renderer/platform/logFailure';
import {optionValueAt} from '@renderer/ui/lists/optionValue';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {PanelAction} from '@renderer/ui/panels/PanelActionSlot';
import {limitReason} from '@core/common/limitReason';
import {
  keyMenuAnchor,
  isContextMenuKey,
  pointerMenuAnchor,
  takeMenuKey,
} from '@renderer/ui/menus/contextMenu';
import {useRef, useState, type JSX, type ReactNode} from 'react';
import {deleteSelection} from '@renderer/ui/lists/selection/deleteSelection';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {createMessageTemplateId} from '@core/schema/common/ids';
import type {Screen} from '@core/schema/screens/screens';
import type {MessageTemplate} from '@core/schema/tools/messages';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import type {Notice} from '@renderer/ui/popups/notices';
import {useDuplicateShortcut} from '../useDuplicateShortcut';
import {useToolEditing} from '../useToolEditing';
import {useUndoKeys} from '@renderer/platform/undo/useUndoKeys';
import {focusHistorySurface} from '@renderer/ui/lists/selection/focusHistorySurface';
import {useReflow} from '@renderer/ui/panels/useReflow';
import {
  deletesMessage,
  MAX_MESSAGE_TEMPLATES,
  newMessageTemplate,
  saveMessageEdit,
  type MessageEdit,
} from './messageEdits';
import {messageMenuEntries, toolMenuReason} from '../toolMenuEntries';
import {
  MessageTemplateDialog,
  type MessageEditor,
} from './MessageTemplateDialog';
import type {MenuAnchor} from '@renderer/ui/menus/menuModel';
import type {NamedDocument} from '@core/schema/app/settingsDocuments';

/**
 * The editing of the 메시지 templates: their context menu, the add and edit
 * dialogs and the saves; `children` are the list it wraps.
 */
export function MessageEditing({
  document,
  screens,
  onProblem,
  onSelect,
  children,
}: {
  readonly document: NamedDocument<'messages'> | null;
  readonly screens: readonly Screen[];
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onSelect: (id: string) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const [menu, setMenu] = useState<{
    anchor: MenuAnchor;
    item: MessageTemplate;
  } | null>(null);
  const [editor, setEditor] = useState<MessageEditor | null>(null);
  const [renaming, setRenaming] = useState<MessageTemplate | null>(null);
  const renameAfterMenu = useMenuHandoff<MessageTemplate>(
    menu !== null,
    setRenaming,
  );
  const editing = useToolEditing({
    api: window.llp,
    write: saveMessageEdit,
    onProblem,
    area: {
      key: 'messages',
      label: '메시지',
      log: 'Could not edit message templates',
      deletions: {name: 'messages', of: deletesMessage},
    },
  });
  const {busy, run} = editing;
  const root = useRef<HTMLDivElement>(null);
  useUndoKeys(root);
  useReflow(root, {
    ids: document?.value.templates.map(item => item.id) ?? [],
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: 'messages',
  });
  const locked =
    document?.access !== 'editable' || window.llp === undefined || busy;
  const full = (document?.value.templates.length ?? 0) >= MAX_MESSAGE_TEMPLATES;
  const fullReason = full
    ? limitReason('메시지', MAX_MESSAGE_TEMPLATES)
    : undefined;
  /** The template of the list row an event happened in. */
  const templateAt = (
    target: EventTarget | null,
  ): MessageTemplate | undefined => {
    const id = optionValueAt(target);
    return document?.value.templates.find(item => item.id === id);
  };
  const openMenu = (target: EventTarget, anchor: MenuAnchor): boolean => {
    const item = templateAt(target);
    if (item === undefined) return false;
    onSelect(item.id);
    setMenu({anchor, item});
    return true;
  };
  const save = (edit: MessageEdit): void => {
    run(edit).then(
      saved => {
        if (!saved) return;
        setEditor(null);
        if (edit.kind === 'add') onSelect(edit.item.id);
        if (edit.kind === 'duplicate') onSelect(edit.copyId);
      },
      (cause: unknown) =>
        logFailure(window.llp, 'Message edit callback failed', cause),
    );
  };
  const duplicate = (item: MessageTemplate): void =>
    save({
      kind: 'duplicate',
      id: item.id,
      copyId: createMessageTemplateId(crypto.randomUUID()),
    });
  const deleteAfterMenu = useMenuHandoff<MessageTemplate>(
    menu !== null,
    item => {
      deleteSelection(
        1,
        () =>
          !locked &&
          document.value.templates.some(value => value.id === item.id),
        () => {
          focusHistorySurface(root.current);
          save({kind: 'delete', id: item.id});
        },
      );
    },
  );
  useDuplicateShortcut({
    itemAt: event => templateAt(event.target),
    reason: locked ? toolMenuReason(locked, busy) : fullReason,
    run: duplicate,
  });
  return (
    <>
      <PanelAction>
        <IconButton
          icon="plus"
          label="메시지 추가"
          disabled={locked || full}
          title={fullReason}
          onClick={() => setEditor({kind: 'add'})}
        />
      </PanelAction>
      <div
        ref={root}
        onContextMenu={event => {
          if (openMenu(event.target, pointerMenuAnchor(event))) {
            event.preventDefault();
          }
        }}
        onKeyDown={event => {
          if (
            isContextMenuKey(event) &&
            openMenu(
              event.target,
              keyMenuAnchor(
                event,
                event.target instanceof HTMLElement
                  ? event.target
                  : event.currentTarget,
              ),
            )
          ) {
            takeMenuKey(event);
          }
        }}
      >
        {children}
      </div>
      {menu ? (
        <Menu
          context
          label="메시지"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={messageMenuEntries({
            reason: toolMenuReason(locked, busy),
            edit: () => setEditor({kind: 'edit', item: menu.item}),
            rename: () => renameAfterMenu(menu.item),
            duplicate: () => duplicate(menu.item),
            duplicateReason: fullReason,
            remove: () => {
              deleteAfterMenu(menu.item);
              setMenu(null);
            },
          })}
        />
      ) : null}
      {renaming ? (
        <RenameDialog
          name={renaming.name}
          title="메시지 이름 바꾸기"
          locked={locked}
          rename={{
            maxLength: NAME_LIMIT,
            onCommit: name =>
              run({
                kind: 'update',
                id: renaming.id,
                fields: {...renaming, name: name.trim()},
              }),
            onClose: () => setRenaming(null),
          }}
        />
      ) : null}
      {editor ? (
        <MessageTemplateDialog
          editor={editor}
          screens={screens}
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
