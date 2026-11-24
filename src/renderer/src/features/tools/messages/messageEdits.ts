import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import type {MessageTemplate, MessagesFile} from '@core/schema/tools/messages';
import {createMessageTemplateId} from '@core/schema/common/ids';
import type {EditResult} from '@core/schema/services/contentEdit';
import {MAX_MESSAGE_CHARACTERS} from '@core/overlays';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {nameReason} from '@renderer/ui/fields/nameReason';
import {
  editableSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

/** The most 메시지 templates the messages file may hold. */
export const MAX_MESSAGE_TEMPLATES = 500;
/**
 * The fields a 메시지 template is made from: its name and text, and the optional
 * icon, screens and duration.
 */
export type MessageFields = Pick<MessageTemplate, 'name' | 'text'> &
  Partial<Pick<MessageTemplate, 'icon' | 'targets' | 'duration'>>;
/** One change to the 메시지 templates. */
export type MessageEdit =
  | {readonly kind: 'add'; readonly item: MessageTemplate}
  | {
      readonly kind: 'update';
      readonly id: MessageTemplate['id'];
      readonly fields: MessageFields;
    }
  | {
      readonly kind: 'duplicate';
      readonly id: MessageTemplate['id'];
      readonly copyId: MessageTemplate['id'];
    }
  | {readonly kind: 'delete'; readonly id: MessageTemplate['id']};

/** Why a message text can't be saved, or undefined when it can. */
export function messageTextReason(text: string): string | undefined {
  if (text.trim() === '') return '문구를 적어야 저장할 수 있습니다.';
  if (text.length > MAX_MESSAGE_CHARACTERS) return '문구가 너무 깁니다.';
  return undefined;
}
/**
 * Makes a template from `fields` with a new id, and the icon 'msg' unless one
 * is given.
 */
export function newMessageTemplate(fields: MessageFields): MessageTemplate {
  return {
    icon: 'msg',
    ...fields,
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
  if (edit.kind === 'duplicate') {
    return {
      ...file,
      templates: duplicateAfter(file.templates, edit, {
        limit: MAX_MESSAGE_TEMPLATES,
        maxName: NAME_LIMIT,
      }),
    };
  }
  const fields = edit.kind === 'add' ? edit.item : edit.fields;
  if (
    nameReason(fields.name, NAME_LIMIT) !== undefined ||
    messageTextReason(fields.text) !== undefined
  ) {
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

/** Saves a change of the 메시지 templates in the messages file. */
export function saveMessageEdit(
  api: LlpApi,
  edit: MessageEdit,
): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'messages');
    const value = applyEdit(document.value, edit);
    return value === document.value
      ? unchangedSettings(document)
      : {
          type: 'settings.update',
          name: 'messages',
          baseRevision: document.revision,
          value,
        };
  });
}
