import type {LlpApi} from '@contracts/ipc/api';
import type {MessageTemplate, MessagesFile} from '@core/schema/messages';
import {createMessageTemplateId} from '@core/schema/ids';
import type {EditResult} from '@core/schema/contentEdit';
import {MAX_MESSAGE_CHARACTERS} from '@core/overlays/messageText';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {withinLookupTimeout} from '@renderer/session/showOutput';

export const MAX_MESSAGE_TEMPLATES = 500;
export const MESSAGE_NAME_LIMIT = 256;
const SAVE_ATTEMPTS = 2;
export type MessageFields = Pick<MessageTemplate, 'name' | 'text'>;
export type MessageEdit =
  | {readonly kind: 'add'; readonly item: MessageTemplate}
  | {
      readonly kind: 'update';
      readonly id: MessageTemplate['id'];
      readonly fields: MessageFields;
    }
  | {readonly kind: 'delete'; readonly id: MessageTemplate['id']};

export function messageNameReason(name: string): string | undefined {
  if (name.trim() === '') return '이름을 적어야 저장할 수 있습니다';
  if (name.trim().length > MESSAGE_NAME_LIMIT) return '이름이 너무 깁니다';
  return undefined;
}
export function messageTextReason(text: string): string | undefined {
  if (text.trim() === '') return '문장을 적어야 저장할 수 있습니다';
  if (text.length > MAX_MESSAGE_CHARACTERS) return '문장이 너무 깁니다';
  return undefined;
}
export function newMessageTemplate(fields: MessageFields): MessageTemplate {
  return {
    ...fields,
    icon: 'msg',
    id: createMessageTemplateId(crypto.randomUUID()),
  };
}

function applyEdit(file: MessagesFile, edit: MessageEdit): MessagesFile {
  if (edit.kind === 'delete') {
    return {
      ...file,
      templates: file.templates.filter(item => item.id !== edit.id),
    };
  }
  const fields = edit.kind === 'add' ? edit.item : edit.fields;
  if (messageNameReason(fields.name) || messageTextReason(fields.text)) {
    throw new Error('Invalid message template');
  }
  if (edit.kind === 'add') {
    if (file.templates.some(item => item.id === edit.item.id)) return file;
    if (file.templates.length >= MAX_MESSAGE_TEMPLATES) {
      throw new Error('The message template list is full');
    }
    return {
      ...file,
      templates: [...file.templates, {...edit.item, name: fields.name.trim()}],
    };
  }
  if (!file.templates.some(item => item.id === edit.id)) {
    throw new Error('Message template no longer exists');
  }
  return {
    ...file,
    templates: file.templates.map(item =>
      item.id === edit.id
        ? {...item, ...fields, name: fields.name.trim()}
        : item,
    ),
  };
}

export async function saveMessageEdit(
  api: LlpApi,
  edit: MessageEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => sendEdit(api, edit),
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Message edits stopped for closing');
  return result;
}
async function sendEdit(
  api: LlpApi,
  edit: MessageEdit,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'messages'}),
  );
  if (document.name !== 'messages' || document.access !== 'editable') {
    throw new Error('Message settings cannot be edited');
  }
  const value = applyEdit(document.value, edit);
  if (value === document.value) {
    return {ok: true, value: {id: 'messages', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'messages',
    baseRevision: document.revision,
    value,
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < SAVE_ATTEMPTS) {
    return sendEdit(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
