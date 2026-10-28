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
import {editMacroActions, type MacroActionEdit} from './macroActionEdits';

export type MacroChanges = Partial<
  Pick<Macro, 'name' | 'icon' | 'color' | 'runOnStartup'>
>;
export type MacroEdit =
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
    };

function apply(file: MacrosFile, edit: MacroEdit): MacrosFile {
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

export async function saveMacroEdit(
  api: LlpApi,
  edit: MacroEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => send(api, edit),
    refused: null,
    sent: value =>
      value !== null && (value.ok || value.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Macro edits stopped for closing');
  return result;
}

async function send(
  api: LlpApi,
  edit: MacroEdit,
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
