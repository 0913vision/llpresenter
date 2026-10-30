import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import {
  serializeNotices,
  type NoticeSet,
  type NoticesFile,
} from '@core/schema/notices';
import {MAX_NOTICE_IMAGES, MAX_TARGET_SCREENS} from '@core/schema/overlayState';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {withinLookupTimeout} from '@renderer/session/showOutput';

export const MAX_NOTICE_SETS = 500;
const MAX_NAME = 256;
const ATTEMPTS = 2;
export type NoticeChanges = Partial<
  Pick<NoticeSet, 'name' | 'media' | 'interval' | 'loop' | 'targets'>
>;
export type NoticeEdit =
  | {readonly kind: 'add'; readonly item: NoticeSet}
  | {
      readonly kind: 'update';
      readonly id: NoticeSet['id'];
      readonly changes: NoticeChanges;
    }
  | {readonly kind: 'delete'; readonly id: NoticeSet['id']};

export function noticeReason(item: NoticeSet): string | undefined {
  if (!item.name.trim()) return '이름을 입력하세요';
  if (item.name.trim().length > MAX_NAME) return '이름이 너무 깁니다';
  if (!item.media.length) return '이미지를 선택하세요';
  if (item.media.length > MAX_NOTICE_IMAGES) return '이미지가 너무 많습니다';
  if (!Number.isFinite(item.interval) || item.interval <= 0) {
    return '간격을 입력하세요';
  }
  if (!item.targets.length) return '화면을 선택하세요';
  if (
    item.targets.length > MAX_TARGET_SCREENS ||
    new Set(item.targets).size !== item.targets.length
  ) {
    return '화면을 확인하세요';
  }
  return undefined;
}

function apply(file: NoticesFile, edit: NoticeEdit): NoticesFile {
  if (edit.kind === 'delete') {
    return {...file, sets: file.sets.filter(item => item.id !== edit.id)};
  }
  const id = edit.kind === 'add' ? edit.item.id : edit.id;
  const existing = file.sets.find(item => item.id === id);
  if (edit.kind === 'add' && existing) return file;
  if (edit.kind === 'add' && file.sets.length >= MAX_NOTICE_SETS) {
    throw new Error('The notice list is full');
  }
  if (edit.kind === 'update' && !existing) {
    throw new Error('Notice no longer exists');
  }
  const item =
    edit.kind === 'add'
      ? edit.item
      : existing && {...existing, ...edit.changes};
  if (!item || noticeReason(item)) throw new Error('Invalid notice');
  const nextItem = {...item, name: item.name.trim()};
  const next = {
    ...file,
    sets:
      edit.kind === 'add'
        ? [...file.sets, nextItem]
        : file.sets.map(value => (value.id === id ? nextItem : value)),
  };
  if (!serializeNotices(next, 'notices').ok) throw new Error('Invalid notice');
  return next;
}

export async function saveNoticeEdit(
  api: LlpApi,
  edit: NoticeEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => send(api, edit),
    refused: null,
    sent: value =>
      value !== null && (value.ok || value.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Notice edits stopped for closing');
  return result;
}

async function send(
  api: LlpApi,
  edit: NoticeEdit,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'notices'}),
  );
  if (document.name !== 'notices' || document.access !== 'editable') {
    throw new Error('Notice settings cannot be edited');
  }
  const value = apply(document.value, edit);
  if (value === document.value) {
    return {ok: true, value: {id: 'notices', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'notices',
    baseRevision: document.revision,
    value,
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < ATTEMPTS) {
    return send(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
