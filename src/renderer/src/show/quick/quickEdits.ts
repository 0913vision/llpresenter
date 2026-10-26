import type {LlpApi} from '@shared/ipc';
import {createQuickItemId} from '@shared/schema/ids';
import type {
  KnownQuickItem,
  QuickItem,
  QuickItemKind,
} from '@shared/schema/quick';
import {withinLookupTimeout} from '@renderer/state/showOutput';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import type {EditResult} from '@shared/schema/contentEdit';
import {MAX_QUICK_ITEMS} from '@shared/schema/quick';

export {MAX_QUICK_ITEMS} from '@shared/schema/quick';
export const QUICK_NAME_LIMIT = 256;
const SAVE_ATTEMPTS = 2;

export type QuickChoice = {
  [Kind in QuickItemKind]: Omit<Extract<KnownQuickItem, {kind: Kind}>, 'id'>;
}[QuickItemKind];

export type QuickEdit =
  | {readonly kind: 'add'; readonly item: KnownQuickItem}
  | {
      readonly kind: 'rename';
      readonly id: QuickItem['id'];
      readonly name: string;
    }
  | {readonly kind: 'delete'; readonly id: QuickItem['id']}
  | {
      readonly kind: 'move';
      readonly id: QuickItem['id'];
      readonly before: QuickItem['id'] | null;
    };

export function newQuickItem(choice: QuickChoice): KnownQuickItem {
  return {...choice, id: createQuickItemId(crypto.randomUUID())};
}

export function quickNameReason(name: string): string | undefined {
  if (name.trim() === '') return '이름을 적어야 저장할 수 있습니다';
  if (name.trim().length > QUICK_NAME_LIMIT) return '이름이 너무 깁니다';
  return undefined;
}

function applyEdit(
  items: readonly QuickItem[],
  edit: QuickEdit,
): readonly QuickItem[] {
  switch (edit.kind) {
    case 'add':
      if (items.some(item => item.id === edit.item.id)) return items;
      if (items.length >= MAX_QUICK_ITEMS) {
        throw new Error('The quick list is full');
      }
      if (quickNameReason(edit.item.name)) {
        throw new Error('Invalid quick item name');
      }
      return [...items, {...edit.item, name: edit.item.name.trim()}];
    case 'rename':
      if (quickNameReason(edit.name)) {
        throw new Error('Invalid quick item name');
      }
      return items.map(item =>
        item.id === edit.id ? {...item, name: edit.name.trim()} : item,
      );
    case 'delete':
      return items.filter(item => item.id !== edit.id);
    case 'move': {
      const source = items.find(item => item.id === edit.id);
      if (!source || edit.before === edit.id) return items;
      const rest = items.filter(item => item.id !== edit.id);
      const index =
        edit.before === null
          ? rest.length
          : rest.findIndex(item => item.id === edit.before);
      if (index < 0) return items;
      const moved = [...rest.slice(0, index), source, ...rest.slice(index)];
      return moved.every((item, at) => item === items[at]) ? items : moved;
    }
    default: {
      const unhandled: never = edit;
      return unhandled;
    }
  }
}

/** Keeps the complete settings operation in the window's close gate. */
export async function saveQuickEdit(
  api: LlpApi,
  edit: QuickEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => sendQuickEdit(api, edit),
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Quick edits stopped for closing');
  return result;
}

async function sendQuickEdit(
  api: LlpApi,
  edit: QuickEdit,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'quick'}),
  );
  if (document.name !== 'quick' || document.access !== 'editable') {
    throw new Error('Quick settings cannot be edited');
  }
  const items = applyEdit(document.value.items, edit);
  if (items === document.value.items) {
    return {ok: true, value: {id: 'quick', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'quick',
    baseRevision: document.revision,
    value: {...document.value, items},
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendQuickEdit(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
