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
  if (edit.kind === 'duplicate') {
    const next = {
      ...file,
      collections: duplicateAfter(file.collections, edit, {
        limit: MACRO_FILE_LIMITS.collections,
        maxName: NAME_LIMIT,
      }),
    };
    if (!serializeMacros(next, 'macros').ok) {
      throw new Error('Invalid collection');
    }
    return next;
  }
  const id = edit.kind === 'add' ? edit.collection.id : edit.id;
  const existing = file.collections.find(item => item.id === id);
  if (edit.kind === 'move') {
    if (!existing || edit.before === id) return file;
    const collections = file.collections.filter(item => item.id !== id);
    const index =
      edit.before === undefined
        ? collections.length
        : collections.findIndex(item => item.id === edit.before);
    if (index < 0) throw new Error('Collection no longer exists');
    collections.splice(index, 0, existing);
    return collections.every((item, at) => item === file.collections[at])
      ? file
      : {...file, collections};
  }
  if (edit.kind === 'delete') {
    if (!existing) return file;
    return {
      ...file,
      collections: file.collections.filter(item => item.id !== id),
    };
  }
  if (edit.kind === 'add' && existing) return file;
  if (
    edit.kind === 'add' &&
    edit.requireMember &&
    !file.macros.some(item => item.id === edit.requireMember)
  ) {
    throw new Error('Macro no longer exists');
  }
  if (
    edit.kind === 'add' &&
    file.collections.length >= MACRO_FILE_LIMITS.collections
  ) {
    throw new Error('Macro collections are full');
  }
  if (edit.kind === 'rename' && !existing) {
    throw new Error('Collection no longer exists');
  }
  const name = (edit.kind === 'add' ? edit.collection.name : edit.name).trim();
  if (nameReason(name, NAME_LIMIT) !== undefined) {
    throw new Error('Invalid collection name');
  }
  if (edit.kind === 'rename' && existing?.name === name) return file;
  const item =
    edit.kind === 'add'
      ? {...edit.collection, name}
      : existing && {...existing, name};
  if (!item) throw new Error('Collection no longer exists');
  const next = {
    ...file,
    collections:
      edit.kind === 'add'
        ? [...file.collections, item]
        : file.collections.map(value => (value.id === id ? item : value)),
  };
  if (!serializeMacros(next, 'macros').ok) {
    throw new Error('Invalid collection');
  }
  return next;
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
