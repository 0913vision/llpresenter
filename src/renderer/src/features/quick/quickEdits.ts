import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import {createQuickItemId, type TimerId} from '@core/schema/common/ids';
import {
  type KnownQuickItem,
  type QuickItem,
  type QuickItemKind,
  isKnownQuickItem,
  MAX_QUICK_ITEMS,
} from '@core/schema/tools/quick';
import {
  editableSettings,
  gatedSettingsWrite,
  unchangedSettings,
} from '@renderer/session/settingsWrites';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {QuickTimerEdit} from '@core/schema/tools/quickTimerEdit';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {nameReason} from '@renderer/ui/fields/nameReason';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/tools/timers';

export {MAX_QUICK_ITEMS} from '@core/schema/tools/quick';
const SAVE_ATTEMPTS = 2;

export type QuickChoice = {
  [Kind in QuickItemKind]: Omit<Extract<KnownQuickItem, {kind: Kind}>, 'id'>;
}[QuickItemKind];

export type QuickEdit =
  | (Omit<
      Extract<QuickTimerEdit, {type: 'quick.timer.create'}>,
      'type' | 'name'
    > & {readonly kind: 'timer-add'})
  | {readonly kind: 'add'; readonly item: KnownQuickItem}
  | {
      readonly kind: 'rename';
      readonly id: QuickItem['id'];
      readonly name: string;
    }
  | {readonly kind: 'delete'; readonly id: QuickItem['id']}
  | {
      readonly kind: 'restore';
      readonly item: QuickItem;
      readonly before: QuickItem['id'] | null;
    }
  | {
      readonly kind: 'duplicate';
      readonly id: QuickItem['id'];
      readonly copyId: QuickItem['id'];
      /** For a 타이머 row: the id its copy's own 타이머 takes. */
      readonly timerCopyId?: TimerId | undefined;
    }
  | {
      readonly kind: 'move';
      readonly id: QuickItem['id'];
      readonly before: QuickItem['id'] | null;
    };

export function newQuickItem(choice: QuickChoice): KnownQuickItem {
  return {...choice, id: createQuickItemId(crypto.randomUUID())};
}

function applyEdit(
  items: readonly QuickItem[],
  edit: Exclude<QuickEdit, {kind: 'timer-add'}>,
): readonly QuickItem[] {
  switch (edit.kind) {
    case 'add':
      if (items.some(item => item.id === edit.item.id)) return items;
      if (items.length >= MAX_QUICK_ITEMS) {
        throw new Error('The quick list is full');
      }
      if (nameReason(edit.item.name, NAME_LIMIT) !== undefined) {
        throw new Error('Invalid quick item name');
      }
      return [...items, {...edit.item, name: edit.item.name.trim()}];
    case 'rename':
      if (nameReason(edit.name, NAME_LIMIT) !== undefined) {
        throw new Error('Invalid quick item name');
      }
      return items.map(item =>
        item.id === edit.id ? {...item, name: edit.name.trim()} : item,
      );
    case 'delete':
      return items.filter(item => item.id !== edit.id);
    case 'restore': {
      if (items.some(item => item.id === edit.item.id)) {
        throw new Error('The quick item already exists');
      }
      if (items.length >= MAX_QUICK_ITEMS) {
        throw new Error('The quick list is full');
      }
      const index =
        edit.before === null
          ? items.length
          : items.findIndex(item => item.id === edit.before);
      const at = index < 0 ? items.length : index;
      return [...items.slice(0, at), edit.item, ...items.slice(at)];
    }
    case 'duplicate':
      return duplicateAfter(items, edit, {
        limit: MAX_QUICK_ITEMS,
        maxName: NAME_LIMIT,
      });
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
export function saveQuickEdit(
  api: LlpApi,
  edit: QuickEdit,
): Promise<EditResult> {
  return gatedSettingsWrite(api, () => sendQuickEdit(api, edit));
}

/**
 * A copy of a 빠른 실행 row of a 타이머 owns a new 타이머 (every timer is its
 * own): the 타이머 is copied first, then the row is added after the original
 * with the copy's name and its id. When the second write fails, the 타이머
 * copy is deleted again, as far as that works.
 */
async function duplicateQuickTimer({
  api,
  items,
  revision,
  source,
  edit,
}: {
  readonly api: LlpApi;
  readonly items: readonly QuickItem[];
  /** The revision of the quick list that `items` was read at. */
  readonly revision: number;
  readonly source: Extract<KnownQuickItem, {kind: 'timer'}>;
  readonly edit: Extract<QuickEdit, {kind: 'duplicate'}>;
}): Promise<EditResult> {
  const {timerCopyId} = edit;
  if (timerCopyId === undefined) throw new Error('The copy needs a timer ID');
  if (items.some(item => item.id === edit.copyId)) {
    return {ok: true, value: {id: 'quick', revision}};
  }
  if (items.length >= MAX_QUICK_ITEMS) {
    throw new Error('The quick list is full');
  }
  const timers = await editableSettings(api, 'timers');
  const copied = duplicateAfter(
    timers.value.timers,
    {id: source.ref, copyId: timerCopyId},
    {limit: MAX_TIMER_DEFINITIONS, maxName: NAME_LIMIT},
  );
  const timerName = copied.find(timer => timer.id === timerCopyId)?.name;
  if (timerName === undefined) throw new Error('The timer copy is missing');
  const timerResult = await api.settings.edit({
    type: 'settings.update',
    name: 'timers',
    baseRevision: timers.revision,
    value: {...timers.value, timers: copied},
  });
  if (!timerResult.ok && timerResult.error.reason !== 'write-failed') {
    throw new Error(timerResult.error.message);
  }
  try {
    const quick = await editableSettings(api, 'quick');
    const at = quick.value.items.findIndex(item => item.id === source.id);
    if (at < 0) throw new Error('The original no longer exists');
    const row = {
      ...source,
      id: edit.copyId,
      ref: timerCopyId,
      name: timerName,
    };
    const result = await api.settings.edit({
      type: 'settings.update',
      name: 'quick',
      baseRevision: quick.revision,
      value: {
        ...quick.value,
        items: [
          ...quick.value.items.slice(0, at + 1),
          row,
          ...quick.value.items.slice(at + 1),
        ],
      },
    });
    if (!result.ok && result.error.reason !== 'write-failed') {
      throw new Error(result.error.message);
    }
    return result;
  } catch (cause) {
    await removeOrphanTimer(api, timerCopyId);
    throw cause;
  }
}

/**
 * Best effort after a refused second write: the 타이머 copy has no row, so it
 * goes again, and a failure to remove it is logged, not hidden.
 */
async function removeOrphanTimer(api: LlpApi, timerId: TimerId): Promise<void> {
  try {
    const result = await api.settings.edit({
      type: 'timer.delete',
      name: 'timers',
      timerId,
    });
    if (!result.ok && result.error.reason !== 'write-failed') {
      throw new Error(result.error.message);
    }
  } catch (cause) {
    api.log.write({
      level: 'warn',
      message: 'Could not remove a timer copy that has no quick row',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

async function sendQuickEdit(
  api: LlpApi,
  edit: QuickEdit,
  attempt = 0,
): Promise<EditResult> {
  if (edit.kind === 'timer-add') {
    return api.settings.edit({
      type: 'quick.timer.create',
      name: 'quick',
      quickItemId: edit.quickItemId,
      timerId: edit.timerId,
      duration: edit.duration,
      ...(edit.overrun === undefined ? {} : {overrun: edit.overrun}),
    });
  }
  const document = await editableSettings(api, 'quick');
  if (edit.kind === 'rename') {
    const item = document.value.items.find(item => item.id === edit.id);
    if (item && isKnownQuickItem(item) && item.kind === 'timer') {
      if (nameReason(edit.name, NAME_LIMIT) !== undefined) {
        throw new Error('Invalid quick item name');
      }
      return api.settings.edit({
        type: 'quick.timer.rename',
        name: 'quick',
        quickItemId: item.id,
        timerName: edit.name.trim(),
      });
    }
  }
  if (edit.kind === 'duplicate') {
    const source = document.value.items.find(item => item.id === edit.id);
    if (
      source !== undefined &&
      isKnownQuickItem(source) &&
      source.kind === 'timer'
    ) {
      return duplicateQuickTimer({
        api,
        items: document.value.items,
        revision: document.revision,
        source,
        edit,
      });
    }
  }
  const items = applyEdit(document.value.items, edit);
  if (items === document.value.items) {
    return unchangedSettings(document);
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
