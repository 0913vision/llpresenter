import {useEffect, useRef, useState, type JSX} from 'react';
import {parseMacroId} from '@shared/schema/ids';
import {
  MACRO_FILE_LIMITS,
  isKnownMacroAction,
  type MacroActionKind,
  type Macro,
  type MacroCollection,
} from '@shared/schema/macros';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {sendLive} from '@renderer/state/live';
import {AlertDialog, Dialog, Menu, TextField} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {MacroView, type MacroViewMode} from './MacroView';
import {saveMacroEdit, type MacroEdit} from './macroEdits';
import {countMacroUses} from './macroUsage';
import {useToolEditing} from './useToolEditing';
import {MacroActionDialog} from './MacroActionDialog';
import {draftMacroAction} from './macroActionDraft';
import {MACRO_PALETTE} from './macroPaletteCatalog';
import {useMacroTargets} from './useMacroTargets';

type Editor =
  | {
      kind: 'action';
      item: Macro;
      actionKind: MacroActionKind;
      index?: number | undefined;
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
        title="\ub3d9\uc791 \uc124\uc815"
        size="s"
        onCancel={close}
        primary={{
          label: '\uc644\ub8cc',
          disabled: true,
          onSelect: () => undefined,
        }}
      >
        <span>\ub300\uc0c1\uc744 \ubd88\ub7ec\uc624\ub294 \uc911</span>
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
        previous && isKnownMacroAction(previous)
          ? draftMacroAction(previous)
          : undefined
      }
      locked={locked}
      onCancel={close}
      onSave={save}
    />
  );
}

function actionLabel(kind: string): string {
  return (
    MACRO_PALETTE.flatMap(group => group.actions).find(
      action => action.kind === kind,
    )?.label ?? kind
  );
}

export function MacroPanel({
  lastRunId,
  onProblem,
}: {
  readonly lastRunId?: Macro['id'] | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('macros', '매크로', onProblem);
  const [collection, setCollection] = useState<MacroCollection['id']>();
  const [mode, setMode] = useState<MacroViewMode>('grid');
  const [menu, setMenu] = useState<{item: Macro; anchor: MenuAnchor} | null>(
    null,
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const revision = useRef(0);
  const pendingCount = useRef<AbortController | null>(null);
  useEffect(() => () => pendingCount.current?.abort(), []);
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveMacroEdit,
    onProblem,
    area: {key: 'macros', label: '매크로', log: 'Could not edit macros'},
  });
  const locked = busy || document?.access !== 'editable' || !window.llp;
  const currentCollection = document?.value.collections.find(
    item => item.id === collection,
  )?.id;
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
  return (
    <>
      <MacroView
        macros={document?.value.macros ?? []}
        collections={document?.value.collections ?? []}
        collectionId={currentCollection}
        mode={mode}
        selectedId={editor?.item.id ?? menu?.item.id}
        lastRunId={lastRunId}
        onCollection={id => {
          revision.current++;
          setCollection(id);
        }}
        onMode={value => {
          revision.current++;
          setMode(value);
        }}
        onRun={start}
        onMenu={(item, anchor) => {
          revision.current++;
          setMenu({item, anchor});
        }}
        onNew={
          !locked && document.value.macros.length < MACRO_FILE_LIMITS.macros
            ? create
            : undefined
        }
      />
      {menu ? (
        <Menu
          label="매크로"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'run',
              label: '실행',
              onSelect: () => start(menu.item),
            },
            {
              kind: 'item',
              id: 'rename',
              label: '이름 바꾸기',
              disabled: locked,
              onSelect: () => setEditor({kind: 'rename', item: menu.item}),
            },
            {
              kind: 'item',
              id: 'add-action',
              label: '\ub3d9\uc791 \ucd94\uac00',
              disabled:
                locked || menu.item.actions.length >= MACRO_FILE_LIMITS.actions,
              submenu: MACRO_PALETTE.flatMap(group => group.actions).map(
                action => ({
                  kind: 'item' as const,
                  id: action.kind,
                  label: action.label,
                  onSelect: () =>
                    setEditor({
                      kind: 'action',
                      item: menu.item,
                      actionKind: action.kind,
                    }),
                }),
              ),
            },
            {
              kind: 'item',
              id: 'edit-action',
              label: '\ub3d9\uc791 \ud3b8\uc9d1',
              disabled: locked || menu.item.actions.length === 0,
              submenu: menu.item.actions.map((action, index) => ({
                kind: 'item' as const,
                id: String(index),
                label: `${index + 1}. ${actionLabel(action.kind)}`,
                disabled: !isKnownMacroAction(action),
                onSelect: () => {
                  if (isKnownMacroAction(action)) {
                    setEditor({
                      kind: 'action',
                      item: menu.item,
                      actionKind: action.kind,
                      index,
                    });
                  }
                },
              })),
            },
            {
              kind: 'item',
              id: 'remove-action',
              label: '\ub3d9\uc791 \ube7c\uae30',
              disabled: locked || menu.item.actions.length === 0,
              submenu: menu.item.actions.map((action, index) => ({
                kind: 'item' as const,
                id: String(index),
                label: `${index + 1}. ${actionLabel(action.kind)}`,
                onSelect: () =>
                  commit({
                    kind: 'action',
                    id: menu.item.id,
                    action: {
                      kind: 'remove',
                      index,
                      expected: menu.item.actions,
                    },
                  }),
              })),
            },
            {
              kind: 'item',
              id: 'duplicate',
              label: '\ubcf5\uc81c',
              disabled:
                locked ||
                document.value.macros.length >= MACRO_FILE_LIMITS.macros,
              onSelect: () => {
                const copyId = parseMacroId(crypto.randomUUID());
                if (copyId.ok) {
                  commit({
                    kind: 'duplicate',
                    id: menu.item.id,
                    copyId: copyId.value,
                  });
                }
              },
            },
            {
              kind: 'item',
              id: 'startup',
              label: '시작할 때 실행',
              check: 'checkbox',
              checked: menu.item.runOnStartup === true,
              disabled: locked,
              onSelect: () =>
                commit({
                  kind: 'update',
                  id: menu.item.id,
                  changes: {runOnStartup: !menu.item.runOnStartup},
                }),
            },
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              disabled: locked,
              onSelect: () => askDelete(menu.item),
            },
          ]}
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
