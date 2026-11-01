import {useState, type JSX} from 'react';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {usageMeta} from '@renderer/ui/usageMeta';
import {AlertDialog, Dialog, TextField} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {isKnownMacroAction} from '@core/schema/macros';
import {draftMacroAction} from '@core/macros/macroActionDraft';
import {MacroActionDialog} from './MacroActionDialog';
import {useMacroTargets} from './useMacroTargets';
import {MacroIconDialog} from './MacroIconDialog';
import {MacroColorPopover} from './MacroColorPopover';
import type {MacroEditor, MacroPanelModel} from './useMacroPanel';

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
  readonly editor: Extract<MacroEditor, {kind: 'action'}>;
  readonly locked: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly close: () => void;
  readonly save: (
    action: import('@core/schema/macros').KnownMacroAction,
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

/** Renders the current editor snapshot and delegates all writes to the panel model. */
export function MacroEditors({
  model,
}: {
  readonly model: MacroPanelModel;
}): JSX.Element {
  const {
    editor,
    collectionDialog,
    locked,
    onProblem,
    close,
    closeCollection,
    saveIcon,
    saveColor,
    saveAction,
    saveNewCollection,
    rename,
    deleteCollection,
    deleteMacro,
  } = model;
  return (
    <>
      {editor?.kind === 'icon' ? (
        <MacroIconDialog
          value={editor.item.icon}
          locked={locked}
          close={close}
          save={saveIcon}
        />
      ) : null}
      {editor?.kind === 'color' ? (
        <MacroColorPopover
          anchor={editor.anchor}
          value={editor.item.color}
          locked={locked}
          onClose={close}
          onChange={saveColor}
        />
      ) : null}
      {editor?.kind === 'action' ? (
        <ActionDialog
          editor={editor}
          locked={locked}
          onProblem={onProblem}
          close={close}
          save={saveAction}
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
              onSelect: deleteCollection,
            },
          ]}
        />
      ) : null}
      {editor?.kind === 'new-collection' ? (
        <CollectionDialog
          locked={locked}
          close={close}
          save={saveNewCollection}
        />
      ) : null}
      {editor?.kind === 'rename' ? (
        <RenameDialog
          key={editor.item.id}
          name={editor.item.name}
          title="매크로 이름 바꾸기"
          locked={locked}
          maxLength={256}
          rename={{
            onClose: close,
            validate: name =>
              name.length > 256 ? '이름이 너무 깁니다' : undefined,
            onCommit: rename,
          }}
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="warning"
          title={`‘${editor.item.name}’ 매크로를 삭제할까요?`}
          meta={
            editor.failed
              ? ['예배 순서 사용 항목을 확인할 수 없습니다']
              : editor.uses === null
                ? ['사용 항목을 확인하는 중']
                : usageMeta(
                    editor.uses,
                    `예배 순서 항목 ${editor.uses}곳에서 씀`,
                  )
          }
          onCancel={close}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked || editor.uses === null,
              onSelect: deleteMacro,
            },
          ]}
        />
      ) : null}
    </>
  );
}
