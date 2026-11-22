import {useState, type JSX} from 'react';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {Dialog, TextField} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {isKnownMacroAction} from '@core/schema/macros';
import {draftMacroAction} from '@core/macros';
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
        aria-label={'이름'}
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
        title={'동작 설정'}
        size="s"
        onCancel={close}
        primary={{
          label: '완료',
          disabled: true,
          onSelect: () => undefined,
        }}
      >
        <span>{'대상을 불러오는 중'}</span>
      </Dialog>
    );
  }
  return (
    <MacroActionDialog
      kind={editor.actionKind}
      choices={targets.choices}
      screens={targets.screens}
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
    locked,
    onProblem,
    close,
    saveIcon,
    saveColor,
    saveAction,
    saveNewCollection,
    rename,
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
    </>
  );
}
