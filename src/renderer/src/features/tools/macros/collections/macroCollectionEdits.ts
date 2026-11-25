import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {nameReason} from '@renderer/ui/fields/nameReason';
import type {EditResult} from '@core/schema/services/contentEdit';
import {
  MACRO_FILE_LIMITS,
  serializeMacros,
  type Macro,
  type MacroCollection,
  type MacrosFile,
} from '@core/schema/tools/macros';
import {
  editableSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

/** One change to the collections of macros. */
export type MacroCollectionEdit =
  | {
      readonly kind: 'add';
      readonly collection: MacroCollection;
      readonly requireMember?: Macro['id'] | undefined;
    }
  | {
      readonly kind: 'rename';
      readonly id: MacroCollection['id'];
      readonly name: string;
    }
  | {readonly kind: 'delete'; readonly id: MacroCollection['id']}
  | {
      readonly kind: 'duplicate';
      readonly id: MacroCollection['id'];
      readonly copyId: MacroCollection['id'];
    }
  | {
      readonly kind: 'move';
      readonly id: MacroCollection['id'];
      readonly before: MacroCollection['id'] | undefined;
    };

function apply(file: MacrosFile, edit: MacroCollectionEdit): MacrosFile {
  switch (edit.kind) {
    case 'duplicate':
      return checked({
        ...file,
        collections: duplicateAfter(file.collections, edit, {
          limit: MACRO_FILE_LIMITS.collections,
          maxName: NAME_LIMIT,
        }),
      });
    case 'move':
      return moveCollection(file, edit.id, edit.before);
    case 'delete':
      return file.collections.some(item => item.id === edit.id)
        ? {
            ...file,
            collections: file.collections.filter(item => item.id !== edit.id),
          }
        : file;
    case 'add':
      return addCollection(file, edit);
    case 'rename':
      return renameCollection(file, edit.id, edit.name);
  }
}

/** Puts a 모음 before another, or last; nothing when it stays in place. */
function moveCollection(
  file: MacrosFile,
  id: MacroCollection['id'],
  before: MacroCollection['id'] | undefined,
): MacrosFile {
  const moved = file.collections.find(item => item.id === id);
  if (!moved || before === id) return file;
  const collections = file.collections.filter(item => item.id !== id);
  const index =
    before === undefined
      ? collections.length
      : collections.findIndex(item => item.id === before);
  if (index < 0) throw new Error('Collection no longer exists');
  collections.splice(index, 0, moved);
  return collections.every((item, at) => item === file.collections[at])
    ? file
    : {...file, collections};
}

/**
 * Adds a 모음 last. One whose id is there already was added before; one made
 * for a 매크로 needs that 매크로 still there.
 */
function addCollection(
  file: MacrosFile,
  {collection, requireMember}: Extract<MacroCollectionEdit, {kind: 'add'}>,
): MacrosFile {
  if (file.collections.some(item => item.id === collection.id)) return file;
  if (requireMember && !file.macros.some(item => item.id === requireMember)) {
    throw new Error('Macro no longer exists');
  }
  if (file.collections.length >= MACRO_FILE_LIMITS.collections) {
    throw new Error('Macro collections are full');
  }
  const name = collectionName(collection.name);
  return checked({
    ...file,
    collections: [...file.collections, {...collection, name}],
  });
}

/** Names a 모음 anew; nothing when the name stays. */
function renameCollection(
  file: MacrosFile,
  id: MacroCollection['id'],
  value: string,
): MacrosFile {
  const existing = file.collections.find(item => item.id === id);
  if (!existing) throw new Error('Collection no longer exists');
  const name = collectionName(value);
  if (existing.name === name) return file;
  return checked({
    ...file,
    collections: file.collections.map(item =>
      item.id === id ? {...existing, name} : item,
    ),
  });
}

/** A 모음 name trimmed; one the name rule refuses is refused. */
function collectionName(value: string): string {
  const name = value.trim();
  if (nameReason(name, NAME_LIMIT) !== undefined) {
    throw new Error('Invalid collection name');
  }
  return name;
}

/** The macros file, once it is one the file format takes. */
function checked(file: MacrosFile): MacrosFile {
  if (!serializeMacros(file, 'macros').ok) {
    throw new Error('Invalid collection');
  }
  return file;
}

/** Saves a change of the macro collections in the macros file. */
export function saveMacroCollectionEdit(
  api: LlpApi,
  edit: MacroCollectionEdit,
): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'macros');
    const value = apply(document.value, edit);
    return value === document.value && edit.kind !== 'rename'
      ? unchangedSettings(document)
      : {
          type: 'settings.update',
          name: 'macros',
          baseRevision: document.revision,
          value,
        };
  });
}

/** Whether a 모음 edit deletes a 모음. */
export function deletesCollection(edit: MacroCollectionEdit): boolean {
  return edit.kind === 'delete';
}
