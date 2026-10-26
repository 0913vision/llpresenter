import type {LlpApi} from '@shared/ipc';
import {createQuickItemId} from '@shared/schema/ids';
import type {
  KnownQuickItem,
  QuickItem,
  QuickItemKind,
} from '@shared/schema/quick';
import {withinLookupTimeout} from '@renderer/state/showOutput';

export const MAX_QUICK_ITEMS = 500;
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
  | {readonly kind: 'delete'; readonly id: QuickItem['id']};

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
    default: {
      const unhandled: never = edit;
      return unhandled;
    }
  }
}

/** Rebases an edit on the latest snapshot, retrying one stale revision. */
export async function saveQuickEdit(
  api: LlpApi,
  edit: QuickEdit,
): Promise<void> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const document = await withinLookupTimeout(() =>
      api.settings.get({name: 'quick'}),
    );
    if (document.name !== 'quick' || document.access !== 'editable') {
      throw new Error('Quick settings cannot be edited');
    }
    const items = applyEdit(document.value.items, edit);
    const result = await api.settings.edit({
      type: 'settings.update',
      name: 'quick',
      baseRevision: document.revision,
      value: {...document.value, items},
    });
    if (result.ok) return;
    if (result.error.reason !== 'stale' || attempt === SAVE_ATTEMPTS - 1) {
      throw new Error(result.error.message);
    }
  }
}
