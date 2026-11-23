import type {LlpApi} from '@contracts/ipc/api';
import {copyName} from '@core/common/copyName';
import type {EditResult} from '@core/schema/contentEdit';
import {
  MACRO_FILE_LIMITS,
  serializeMacros,
  type Macro,
  type MacroCollection,
  type MacrosFile,
} from '@core/schema/macros';
import {editMacroActions, type MacroActionEdit} from '@core/macros';
import {
  editableSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

export type MacroChanges = Partial<
  Pick<Macro, 'name' | 'icon' | 'color' | 'runOnStartup'>
>;
export type MacroEdit =
  | {
      readonly kind: 'duplicate';
      readonly id: Macro['id'];
      readonly copyId: Macro['id'];
    }
  | {
      readonly kind: 'add';
      readonly item: Macro;
      readonly collection?: MacroCollection['id'] | undefined;
    }
  | {
      readonly kind: 'update';
      readonly id: Macro['id'];
      readonly changes: MacroChanges;
    }
  | {readonly kind: 'delete'; readonly id: Macro['id']}
  | {
      readonly kind: 'action';
      readonly id: Macro['id'];
      readonly action: MacroActionEdit;
    }
  | {
      readonly kind: 'membership';
      readonly id: Macro['id'];
      readonly collection: MacroCollection['id'];
      readonly member: boolean;
    }
  | {
      readonly kind: 'move';
      readonly id: Macro['id'];
      readonly from: MacroCollection['id'];
      readonly to: MacroCollection['id'];
    };

const MACRO_NAME_LIMIT = 256;

function duplicate(
  file: MacrosFile,
  id: Macro['id'],
  copyId: Macro['id'],
): MacrosFile {
  if (file.macros.some(item => item.id === copyId)) return file;
  const index = file.macros.findIndex(item => item.id === id);
  const source = file.macros[index];
  if (!source) throw new Error('Macro no longer exists');
  if (file.macros.length >= MACRO_FILE_LIMITS.macros) {
    throw new Error('Macro list is full');
  }
  const name = copyName(
    source.name,
    file.macros.map(item => item.name),
    {maxLength: MACRO_NAME_LIMIT},
  );
  const collections = file.collections.map(group => {
    const position = group.macroIds.indexOf(id);
    if (position < 0) return group;
    if (group.macroIds.length >= MACRO_FILE_LIMITS.collectionItems) {
      throw new Error('Collection is full');
    }
    return {
      ...group,
      macroIds: [
        ...group.macroIds.slice(0, position + 1),
        copyId,
        ...group.macroIds.slice(position + 1),
      ],
    };
  });
  const next = {
    ...file,
    collections,
    macros: [
      ...file.macros.slice(0, index + 1),
      {...source, id: copyId, name},
      ...file.macros.slice(index + 1),
    ],
  };
  if (!serializeMacros(next, 'macros').ok) {
    throw new Error('Invalid macro copy');
  }
  return next;
}

/** Moves a 매크로 between collections in one write. */
function move(
  file: MacrosFile,
  edit: Extract<MacroEdit, {kind: 'move'}>,
): MacrosFile {
  const {id, from, to} = edit;
  const added = apply(file, {
    kind: 'membership',
    id,
    collection: to,
    member: true,
  });
  return apply(added, {
    kind: 'membership',
    id,
    collection: from,
    member: false,
  });
}

function apply(file: MacrosFile, edit: MacroEdit): MacrosFile {
  if (edit.kind === 'duplicate') return duplicate(file, edit.id, edit.copyId);
  if (edit.kind === 'move') return move(file, edit);
  if (edit.kind === 'delete') {
    return {
      ...file,
      macros: file.macros.filter(item => item.id !== edit.id),
      collections: file.collections.map(group => ({
        ...group,
        macroIds: group.macroIds.filter(id => id !== edit.id),
      })),
    };
  }
  const id = edit.kind === 'add' ? edit.item.id : edit.id;
  const existing = file.macros.find(item => item.id === id);
  if (edit.kind === 'add' && existing) return file;
  if (edit.kind === 'add' && file.macros.length >= MACRO_FILE_LIMITS.macros) {
    throw new Error('Macro list is full');
  }
  if (edit.kind !== 'add' && !existing) {
    throw new Error('Macro no longer exists');
  }
  const collectionId =
    edit.kind === 'add'
      ? edit.collection
      : edit.kind === 'membership'
        ? edit.collection
        : undefined;
  const collection = file.collections.find(group => group.id === collectionId);
  if (collectionId && !collection) {
    throw new Error('Collection no longer exists');
  }
  if (
    edit.kind === 'membership' &&
    collection?.macroIds.includes(id) === edit.member
  ) {
    return file;
  }
  const member =
    edit.kind === 'add' || (edit.kind === 'membership' && edit.member);
  if (
    collection &&
    member &&
    !collection.macroIds.includes(id) &&
    collection.macroIds.length >= MACRO_FILE_LIMITS.collectionItems
  ) {
    throw new Error('Collection is full');
  }
  const collections = collection
    ? file.collections.map(group =>
        group.id !== collection.id
          ? group
          : {
              ...group,
              macroIds: member
                ? group.macroIds.includes(id)
                  ? group.macroIds
                  : [...group.macroIds, id]
                : group.macroIds.filter(value => value !== id),
            },
      )
    : file.collections;
  if (edit.kind === 'membership') return {...file, collections};
  const item =
    edit.kind === 'add'
      ? edit.item
      : edit.kind === 'action'
        ? existing && {
            ...existing,
            actions: editMacroActions(existing.actions, edit.action),
          }
        : existing && {...existing, ...edit.changes};
  if (!item?.name.trim() || item.name.trim().length > 256) {
    throw new Error('Invalid macro name');
  }
  const nextItem = {...item, name: item.name.trim()};
  const next = {
    ...file,
    collections,
    macros:
      edit.kind === 'add'
        ? [...file.macros, nextItem]
        : file.macros.map(value => (value.id === id ? nextItem : value)),
  };
  if (!serializeMacros(next, 'macros').ok) throw new Error('Invalid macro');
  return next;
}

export function saveMacroEdit(
  api: LlpApi,
  edit: MacroEdit,
): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'macros');
    const value = apply(document.value, edit);
    return value === document.value
      ? unchangedSettings(document)
      : {
          type: 'settings.update',
          name: 'macros',
          baseRevision: document.revision,
          value,
        };
  });
}
