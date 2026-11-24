import {useState} from 'react';
import {parseMacroCollectionId} from '@core/schema/common/ids';
import type {KnownMacroAction, Macro} from '@core/schema/tools/macros';
import type {MacroCollectionEdit} from './macroCollectionEdits';
import type {MacroEdit} from './macroEdits';
import type {MacroEditor} from './macroMenuHandlers';

/**
 * The dialog open on one 매크로 (이름, 아이콘, 색, 동작, 새 모음) and its
 * saves; each save closes the dialog once it holds.
 */
export function useMacroEditor({
  onClose,
  commit,
  commitCollection,
  saveName,
}: {
  /** Counts the step, so a late save does not act on what came after. */
  readonly onClose: () => void;
  readonly commit: (edit: MacroEdit, after?: () => void) => void;
  readonly commitCollection: (
    edit: MacroCollectionEdit,
    after: () => void,
  ) => void;
  readonly saveName: (id: Macro['id'], name: string) => Promise<boolean>;
}) {
  const [editor, setEditor] = useState<MacroEditor | null>(null);
  const close = (): void => {
    onClose();
    setEditor(null);
  };
  return {
    editor,
    setEditor,
    close,
    saveIcon: (icon: string): void => {
      if (editor?.kind !== 'icon') return;
      commit({kind: 'update', id: editor.item.id, changes: {icon}}, close);
    },
    saveColor: (color: Macro['color']): void => {
      if (editor?.kind !== 'color') return;
      commit({kind: 'update', id: editor.item.id, changes: {color}}, close);
    },
    saveAction: (action: KnownMacroAction): void => {
      if (editor?.kind !== 'action') return;
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
      );
    },
    saveNewCollection: (name: string): void => {
      if (editor?.kind !== 'new-collection') return;
      const id = parseMacroCollectionId(crypto.randomUUID());
      if (!id.ok) return;
      commitCollection(
        {
          kind: 'add',
          collection: {id: id.value, name, macroIds: [editor.item.id]},
          requireMember: editor.item.id,
        },
        close,
      );
    },
    rename: (name: string): Promise<boolean> =>
      editor?.kind === 'rename'
        ? saveName(editor.item.id, name)
        : Promise.resolve(false),
  };
}
