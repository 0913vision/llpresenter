import type {LlpApi} from '@contracts/ipc/api';
import {copyName} from '@core/common/copyName';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import type {EditResult} from '@core/schema/services/contentEdit';
import {
  MACRO_FILE_LIMITS,
  serializeMacros,
  type Macro,
  type MacroCollection,
  type MacrosFile,
} from '@core/schema/tools/macros';
import {editMacroActions, type MacroActionEdit} from '@core/macros';
import {
  editableSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

/** The fields of a macro that an edit can change. */
export type MacroChanges = Partial<
  Pick<Macro, 'name' | 'icon' | 'color' | 'runOnStartup'>
>;
/** One change to the macros. */
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
    {maxLength: NAME_LIMIT},
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
  switch (edit.kind) {
    case 'duplicate':
      return duplicate(file, edit.id, edit.copyId);
    case 'move':
      return move(file, edit);
    case 'delete':
      return deleteMacro(file, edit.id);
    case 'add':
      return addMacro(file, edit.item, edit.collection);
    case 'membership':
      return setMembership(file, edit);
    case 'update':
      return changeMacro(file, edit.id, macro => ({...macro, ...edit.changes}));
    case 'action':
      return changeMacro(file, edit.id, macro => ({
        ...macro,
        actions: editMacroActions(macro.actions, edit.action),
      }));
  }
}

/** Takes a 매크로 out of the list and out of every collection. */
function deleteMacro(file: MacrosFile, id: Macro['id']): MacrosFile {
  return {
    ...file,
    macros: file.macros.filter(item => item.id !== id),
    collections: file.collections.map(group => ({
      ...group,
      macroIds: group.macroIds.filter(member => member !== id),
    })),
  };
}

/**
 * Adds a 매크로 at the end of the list, and of collection `collectionId` when
 * one is given. A 매크로 whose id is there already was added before.
 */
function addMacro(
  file: MacrosFile,
  macro: Macro,
  collectionId: MacroCollection['id'] | undefined,
): MacrosFile {
  if (file.macros.some(item => item.id === macro.id)) return file;
  if (file.macros.length >= MACRO_FILE_LIMITS.macros) {
    throw new Error('Macro list is full');
  }
  return checked({
    ...file,
    collections:
      collectionId === undefined
        ? file.collections
        : withMember(file, {
            collection: collectionId,
            id: macro.id,
            member: true,
          }),
    macros: [...file.macros, named(macro)],
  });
}

/** Puts a 매크로 in a collection or takes it out; nothing when it is so already. */
function setMembership(
  file: MacrosFile,
  edit: Extract<MacroEdit, {kind: 'membership'}>,
): MacrosFile {
  existingMacro(file, edit.id);
  const collections = withMember(file, edit);
  return collections === file.collections ? file : {...file, collections};
}

/** Changes a 매크로 of the list in its place. */
function changeMacro(
  file: MacrosFile,
  id: Macro['id'],
  change: (macro: Macro) => Macro,
): MacrosFile {
  const changed = named(change(existingMacro(file, id)));
  return checked({
    ...file,
    macros: file.macros.map(item => (item.id === id ? changed : item)),
  });
}

function existingMacro(file: MacrosFile, id: Macro['id']): Macro {
  const macro = file.macros.find(item => item.id === id);
  if (!macro) throw new Error('Macro no longer exists');
  return macro;
}

/**
 * The collections once 매크로 `id` is in `collection` or, when not `member`,
 * out of it; the same list when that is so already.
 */
function withMember(
  file: MacrosFile,
  {
    collection: collectionId,
    id,
    member,
  }: {
    readonly collection: MacroCollection['id'];
    readonly id: Macro['id'];
    readonly member: boolean;
  },
): MacrosFile['collections'] {
  const collection = file.collections.find(group => group.id === collectionId);
  if (!collection) throw new Error('Collection no longer exists');
  if (collection.macroIds.includes(id) === member) return file.collections;
  if (
    member &&
    collection.macroIds.length >= MACRO_FILE_LIMITS.collectionItems
  ) {
    throw new Error('Collection is full');
  }
  return file.collections.map(group =>
    group.id !== collectionId
      ? group
      : {
          ...group,
          macroIds: member
            ? [...group.macroIds, id]
            : group.macroIds.filter(value => value !== id),
        },
  );
}

/** A 매크로 with its name trimmed; a blank or too long name is refused. */
function named(macro: Macro): Macro {
  const name = macro.name.trim();
  if (name === '' || name.length > NAME_LIMIT) {
    throw new Error('Invalid macro name');
  }
  return {...macro, name};
}

/** The macros file, once it is one the file format takes. */
function checked(file: MacrosFile): MacrosFile {
  if (!serializeMacros(file, 'macros').ok) throw new Error('Invalid macro');
  return file;
}

/** Saves a change of the macros in the macros file. */
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

/** Whether a macro edit deletes: a macro, or actions from one. */
export function deletesMacro(edit: MacroEdit): boolean {
  return (
    edit.kind === 'delete' ||
    (edit.kind === 'action' &&
      (edit.action.kind === 'remove' || edit.action.kind === 'removeAll'))
  );
}
