import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {
  MACRO_FILE_LIMITS,
  serializeMacros,
  type Macro,
  type MacroCollection,
  type MacrosFile,
} from '@shared/schema/macros';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {withinLookupTimeout} from '@renderer/state/showOutput';

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
      readonly kind: 'move';
      readonly id: MacroCollection['id'];
      readonly before: MacroCollection['id'] | undefined;
    };

function apply(file: MacrosFile, edit: MacroCollectionEdit): MacrosFile {
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
  if (!name || name.length > 256) throw new Error('Invalid collection name');
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

export async function saveMacroCollectionEdit(
  api: LlpApi,
  edit: MacroCollectionEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => send(api, edit),
    refused: null,
    sent: value =>
      value !== null && (value.ok || value.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Collection edits stopped for closing');
  return result;
}

async function send(
  api: LlpApi,
  edit: MacroCollectionEdit,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'macros'}),
  );
  if (document.name !== 'macros' || document.access !== 'editable') {
    throw new Error('Macro settings cannot be edited');
  }
  const value = apply(document.value, edit);
  if (value === document.value) {
    return {ok: true, value: {id: 'macros', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'macros',
    baseRevision: document.revision,
    value,
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt < 1) {
    return send(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
