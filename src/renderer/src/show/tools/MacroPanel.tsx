import {useContext, useEffect, useRef, useState, type JSX} from 'react';
import {parseMacroCollectionId, parseMacroId} from '@shared/schema/ids';
import {
  MACRO_FILE_LIMITS,
  isKnownMacroAction,
  type MacroActionKind,
  type Macro,
  type MacroCollection,
} from '@shared/schema/macros';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {sendLive} from '@renderer/state/live';
import {WorkspaceNavigation} from '@renderer/state/WorkspaceNavigation';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {useMacroPalette} from '@renderer/state/macroPalette';
import {useScreensSelection} from '@renderer/screens/selection';
import {AlertDialog, Dialog, TextField} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {MacroView, type MacroViewMode} from './MacroView';
import {saveMacroEdit, type MacroEdit} from './macroEdits';
import {countMacroUses} from './macroUsage';
import {useToolEditing} from './useToolEditing';
import {saveMacroCollectionEdit} from './macroCollectionEdits';
import {MacroActionDialog} from './MacroActionDialog';
import {
  draftMacroAction,
  prepareMacroAction,
  type MacroActionDraft,
} from './macroActionDraft';
import {useMacroTargets} from './useMacroTargets';
import {MacroIconDialog} from './MacroIconDialog';
import {MacroColorPopover} from './MacroColorPopover';
import {MacroPalette} from './MacroPalette';
import {MacroMenu} from './MacroMenu';
import type {MacroMenuHandlers} from './macroMenuEntries';
import styles from './MacroPanel.module.css';

type Editor =
  | {kind: 'color'; item: Macro; anchor: HTMLElement}
  | {kind: 'icon'; item: Macro}
  | {kind: 'new-collection'; item: Macro}
  | {
      kind: 'action';
      item: Macro;
      actionKind: MacroActionKind;
      index?: number | undefined;
      initial?: MacroActionDraft | undefined;
    }
  | {kind: 'rename'; item: Macro}
  | {kind: 'delete'; item: Macro; uses: number | null; failed: boolean};

function RenameDialog({
  item,
  locked,
  close,
  save,
}: {
  readonly item: Macro;
  readonly locked: boolean;
  readonly close: () => void;
  readonly save: (name: string) => void;
}): JSX.Element {
  const [name, setName] = useState(item.name);
  const reason = !name.trim()
    ? '이름을 입력하세요'
    : name.trim().length > 256
      ? '이름이 너무 깁니다'
      : undefined;
  return (
    <Dialog
      title="매크로 이름 바꾸기"
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
        maxLength={256}
        value={name}
        onChange={setName}
        readOnly={locked}
        invalid={reason !== undefined}
        invalidReason={reason}
      />
    </Dialog>
  );
}

function CollectionDialog({
  locked,
  close,
  save,
}: {
  readonly locked: boolean;
  readonly close: () => void;
  readonly save: (name: string) => void;
}): JSX.Element {
  const [name, setName] = useState('');
  return (
    <Dialog
      title="새 모음"
      size="s"
      onCancel={close}
      primary={{
        label: '추가',
        disabled: locked || !name.trim() || name.trim().length > 256,
        onSelect: () => save(name.trim()),
      }}
    >
      <TextField
        aria-label={'\uc774\ub984'}
        autoFocus
        block
        maxLength={256}
        readOnly={locked}
        value={name}
        onChange={setName}
      />
    </Dialog>
  );
}

function ActionDialog({
  editor,
  locked,
  onProblem,
  close,
  save,
}: {
  readonly editor: Extract<Editor, {kind: 'action'}>;
  readonly locked: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly close: () => void;
  readonly save: (
    action: import('@shared/schema/macros').KnownMacroAction,
  ) => void;
}): JSX.Element {
  const targets = useMacroTargets(onProblem);
  const previous =
    editor.index === undefined ? undefined : editor.item.actions[editor.index];
  if (!targets) {
    return (
      <Dialog
        title={'\ub3d9\uc791 \uc124\uc815'}
        size="s"
        onCancel={close}
        primary={{
          label: '\uc644\ub8cc',
          disabled: true,
          onSelect: () => undefined,
        }}
      >
        <span>{'\ub300\uc0c1\uc744 \ubd88\ub7ec\uc624\ub294 \uc911'}</span>
      </Dialog>
    );
  }
  return (
    <MacroActionDialog
      kind={editor.actionKind}
      choices={targets.choices}
      screens={
        editor.actionKind === 'stageLayout'
          ? targets.stageScreens
          : targets.screens
      }
      initial={
        editor.initial ??
        (previous && isKnownMacroAction(previous)
          ? draftMacroAction(previous)
          : undefined)
      }
      locked={locked}
      onCancel={close}
      onSave={save}
    />
  );
}

export function MacroPanel({
  lastRunId,
  onProblem,
}: {
  readonly lastRunId?: Macro['id'] | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const navigate = useContext(WorkspaceNavigation);
  const document = useSettingsDocument('macros', '매크로', onProblem);
  const [collection, setCollection] = useState<MacroCollection['id']>();
  const [mode, setMode] = useState<MacroViewMode>('grid');
  const [menu, setMenu] = useState<{
    item: Macro;
    anchor: MenuAnchor;
    trigger: HTMLElement | undefined;
  } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<{
    kind: 'delete';
    item: MacroCollection;
  } | null>(null);
  const palette = useMacroPalette();
  const paletteFor = palette.target;
  const [paletteDragging, setPaletteDragging] = useState(false);
  const revision = useRef(0);
  const pendingCount = useRef<AbortController | null>(null);
  useEffect(() => () => pendingCount.current?.abort(), []);
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveMacroEdit,
    onProblem,
    area: {key: 'macros', label: '매크로', log: 'Could not edit macros'},
  });
  const collectionEdit = useToolEditing({
    api: window.llp,
    write: saveMacroCollectionEdit,
    onProblem,
    area: {
      key: 'macro-collections',
      label: '\ubaa8\uc74c',
      log: 'Could not edit macro collections',
    },
  });
  const locked =
    busy ||
    collectionEdit.busy ||
    document?.access !== 'editable' ||
    !window.llp;
  const currentGroup = document?.value.collections.find(
    item => item.id === collection,
  );
  const currentCollection = currentGroup?.id;
  const closeCollection = (): void => {
    revision.current++;
    setCollectionDialog(null);
  };
  const commitCollection = (
    edit: import('./macroCollectionEdits').MacroCollectionEdit,
    after: () => void,
  ): void => {
    const at = revision.current;
    collectionEdit.run(edit).then(
      saved => {
        if (saved && at === revision.current) after();
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Macro collection callback failed',
          detail: String(cause),
        }),
    );
  };
  const close = (): void => {
    revision.current++;
    pendingCount.current?.abort();
    pendingCount.current = null;
    setEditor(null);
  };
  const commit = (edit: MacroEdit, after?: () => void): void => {
    const at = revision.current;
    run(edit).then(
      saved => {
        if (saved && at === revision.current) after?.();
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Macro edit callback failed',
          detail: String(cause),
        }),
    );
  };
  const start = (item: Macro): void => {
    revision.current++;
    sendLive({type: 'macro.run', macroId: item.id});
  };
  const create = (): void => {
    const parsed = parseMacroId(crypto.randomUUID());
    if (!parsed.ok) return;
    const item: Macro = {
      id: parsed.value,
      name: '새 매크로',
      icon: 'macro',
      color: 'teal',
      actions: [],
    };
    const at = ++revision.current;
    run({kind: 'add', item, collection: currentCollection}).then(
      saved => {
        if (saved && revision.current === at) setEditor({kind: 'rename', item});
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Macro create callback failed',
          detail: String(cause),
        }),
    );
  };
  const askDelete = (item: Macro): void => {
    const api = window.llp;
    if (!api) return;
    pendingCount.current?.abort();
    const controller = new AbortController();
    pendingCount.current = controller;
    setEditor({kind: 'delete', item, uses: null, failed: false});
    countMacroUses(api, item.id, controller.signal).then(
      uses => {
        if (!controller.signal.aborted) {
          setEditor(current =>
            current?.kind === 'delete' && current.item.id === item.id
              ? {...current, uses}
              : current,
          );
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        api.log.write({
          level: 'error',
          message: 'Could not count macro uses',
          detail: String(cause),
        });
        setEditor(current =>
          current?.kind === 'delete' && current.item.id === item.id
            ? {...current, failed: true}
            : current,
        );
      },
    );
  };
  const membership = (
    change: {
      readonly item: Macro;
      readonly collection: MacroCollection['id'];
      readonly member: boolean;
    },
    after?: () => void,
  ): void => {
    const {item, collection, member} = change;
    commit({kind: 'membership', id: item.id, collection, member}, after);
  };
  const menuHandlers = (item: Macro): MacroMenuHandlers => ({
    rename: () => setEditor({kind: 'rename', item}),
    changeIcon: () => setEditor({kind: 'icon', item}),
    changeColor: () => {
      if (menu?.trigger) setEditor({kind: 'color', item, anchor: menu.trigger});
    },
    toggleStartup: () =>
      commit({
        kind: 'update',
        id: item.id,
        changes: {runOnStartup: item.runOnStartup !== true},
      }),
    addTo: collection => membership({item, collection, member: true}),
    moveTo: collection => {
      const from = currentCollection;
      if (from === undefined) return;
      commit({kind: 'move', id: item.id, from, to: collection});
    },
    newCollection: () => setEditor({kind: 'new-collection', item}),
    addAction: actionKind => setEditor({kind: 'action', item, actionKind}),
    chooseAction: (draft, index) => {
      if (draft.kind === 'message' || draft.kind === 'stageLayout') {
        setEditor({
          kind: 'action',
          item,
          actionKind: draft.kind,
          index,
          initial: draft,
        });
        return;
      }
      const action = prepareMacroAction(draft);
      if (action) {
        commit({
          kind: 'action',
          id: item.id,
          action:
            index === undefined
              ? {kind: 'append', action}
              : {kind: 'replace', index, action, expected: item.actions},
        });
      }
    },
    openAction: action => {
      if (action.kind === 'look' || action.kind === 'stageLayout') {
        useScreensSelection
          .getState()
          .select(
            action.kind === 'look' ? 'look' : 'stage',
            action.kind === 'look' ? action.look : action.layout,
          );
        navigate?.('screens');
      } else if (
        action.kind === 'timer' ||
        action.kind === 'prop' ||
        action.kind === 'message' ||
        action.kind === 'notice' ||
        action.kind === 'audio' ||
        action.kind === 'macro'
      ) {
        useShowToolTab.getState().setTool(action.kind);
      } else if (action.kind === 'audioPlaylist') {
        useShowToolTab.getState().setTool('audio');
      }
    },
    removeAllActions: () =>
      commit({
        kind: 'action',
        id: item.id,
        action: {kind: 'removeAll', expected: item.actions},
      }),
    openPalette: () => palette.show(item.id),
    removeAction: index =>
      commit({
        kind: 'action',
        id: item.id,
        action: {kind: 'remove', index, expected: item.actions},
      }),
    duplicate: () => {
      const copyId = parseMacroId(crypto.randomUUID());
      if (copyId.ok) {
        commit({kind: 'duplicate', id: item.id, copyId: copyId.value});
      }
    },
    remove: () => askDelete(item),
  });
  return (
    <>
      <div className={styles.panel}>
        <MacroView
          macros={document?.value.macros ?? []}
          collections={document?.value.collections ?? []}
          collectionId={currentCollection}
          mode={mode}
          selectedId={editor?.item.id ?? menu?.item.id}
          lastRunId={lastRunId}
          collectionLocked={locked}
          onCollectionDelete={item => {
            revision.current++;
            setCollectionDialog({kind: 'delete', item});
          }}
          onProblem={onProblem}
          onCollection={id => {
            revision.current++;
            setCollection(id);
          }}
          onMode={value => {
            revision.current++;
            setMode(value);
          }}
          onRun={start}
          onMenu={(item, anchor, trigger) => {
            revision.current++;
            setMenu({item, anchor, trigger});
          }}
          onDropAction={
            locked
              ? undefined
              : (item, actionKind) => {
                  if (item.actions.length >= MACRO_FILE_LIMITS.actions) return;
                  revision.current++;
                  setEditor({kind: 'action', item, actionKind});
                }
          }
          onNew={
            !locked && document.value.macros.length < MACRO_FILE_LIMITS.macros
              ? create
              : undefined
          }
        />
        {palette.open ? (
          <div
            className={styles.palette}
            data-dragging={paletteDragging || undefined}
            onDragStart={() => setPaletteDragging(true)}
            onDragEnd={() => setPaletteDragging(false)}
          >
            <MacroPalette
              onClose={palette.close}
              onChoose={actionKind => {
                const item = document?.value.macros.find(
                  macro => macro.id === paletteFor,
                );
                if (
                  !locked &&
                  item &&
                  item.actions.length < MACRO_FILE_LIMITS.actions
                ) {
                  revision.current++;
                  setEditor({kind: 'action', item, actionKind});
                }
              }}
            />
          </div>
        ) : null}
      </div>
      {menu ? (
        <MacroMenu
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onProblem={onProblem}
          input={{
            item:
              document?.value.macros.find(item => item.id === menu.item.id) ??
              menu.item,
            collections: document?.value.collections ?? [],
            shown: currentCollection,
            macroCount: document?.value.macros.length ?? 0,
            locked,
          }}
          handlersFor={menuHandlers}
        />
      ) : null}
      {editor?.kind === 'icon' ? (
        <MacroIconDialog
          value={editor.item.icon}
          locked={locked}
          close={close}
          save={icon =>
            commit({kind: 'update', id: editor.item.id, changes: {icon}}, close)
          }
        />
      ) : null}
      {editor?.kind === 'color' ? (
        <MacroColorPopover
          anchor={editor.anchor}
          value={editor.item.color}
          locked={locked}
          onClose={close}
          onChange={color =>
            commit(
              {kind: 'update', id: editor.item.id, changes: {color}},
              close,
            )
          }
        />
      ) : null}
      {editor?.kind === 'action' ? (
        <ActionDialog
          editor={editor}
          locked={locked}
          onProblem={onProblem}
          close={close}
          save={action =>
            commit(
              {
                kind: 'action',
                id: editor.item.id,
                action:
                  editor.index === undefined
                    ? {kind: 'append', action}
                    : {
                        kind: 'replace',
                        index: editor.index,
                        action,
                        expected: editor.item.actions,
                      },
              },
              close,
            )
          }
        />
      ) : null}
      {collectionDialog?.kind === 'delete' ? (
        <AlertDialog
          icon="warning"
          title={`\u2018${collectionDialog.item.name}\u2019 \ubaa8\uc74c\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?`}
          meta={[
            '\ub9e4\ud06c\ub85c\ub294 \uc0ad\uc81c\ub418\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4',
          ]}
          onCancel={closeCollection}
          actions={[
            {
              label: '\uc0ad\uc81c',
              primary: true,
              disabled: locked,
              onSelect: () =>
                commitCollection(
                  {kind: 'delete', id: collectionDialog.item.id},
                  () => {
                    setCollection(current =>
                      current === collectionDialog.item.id
                        ? undefined
                        : current,
                    );
                    closeCollection();
                  },
                ),
            },
          ]}
        />
      ) : null}
      {editor?.kind === 'new-collection' ? (
        <CollectionDialog
          locked={locked}
          close={close}
          save={name => {
            const id = parseMacroCollectionId(crypto.randomUUID());
            if (!id.ok) return;
            const at = revision.current;
            collectionEdit
              .run({
                kind: 'add',
                collection: {id: id.value, name, macroIds: [editor.item.id]},
                requireMember: editor.item.id,
              })
              .then(
                saved => {
                  if (saved && at === revision.current) close();
                },
                (cause: unknown) =>
                  window.llp?.log.write({
                    level: 'error',
                    message: 'Macro collection callback failed',
                    detail: String(cause),
                  }),
              );
          }}
        />
      ) : null}
      {editor?.kind === 'rename' ? (
        <RenameDialog
          key={editor.item.id}
          item={editor.item}
          locked={locked}
          close={close}
          save={name =>
            commit({kind: 'update', id: editor.item.id, changes: {name}}, close)
          }
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="warning"
          title={`‘${editor.item.name}’ 매크로를 삭제할까요?`}
          meta={[
            editor.failed
              ? '예배 순서 사용 항목을 확인할 수 없습니다'
              : editor.uses === null
                ? '사용 항목을 확인하는 중'
                : `예배 순서 항목 ${editor.uses}곳에서 씀`,
          ]}
          onCancel={close}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked || editor.uses === null,
              onSelect: () =>
                commit({kind: 'delete', id: editor.item.id}, close),
            },
          ]}
        />
      ) : null}
    </>
  );
}
