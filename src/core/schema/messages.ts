import * as v from 'valibot';
import type {Result} from '../common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {messageTemplateIdSchema, screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  positiveInteger,
  seconds,
} from './primitives';

/** Screens that a 메시지 goes to: a list of screens, or every screen. */
export const messageTargetsSchema = v.union([
  v.array(screenIdSchema),
  v.literal('all'),
]);

/** How long a 메시지 shows, in seconds, or `null` until it is cleared. */
export const messageDurationSchema = v.nullable(seconds);

const templateSchema = jsonObject({
  id: messageTemplateIdSchema,
  name: v.string(),
  icon: v.picklist(['msg', 'user']),
  text: v.string(),
  targets: v.exactOptional(messageTargetsSchema),
  duration: v.exactOptional(messageDurationSchema),
});

export const messagesSchema = jsonObject({
  format: v.literal('llsettings.messages'),
  schemaVersion: positiveInteger,
  templates: listWithUniqueIds(templateSchema),
  stagePresets: v.array(v.string()),
});

const messagesMigrations: readonly MigrationStep[] = [];

const messagesFormat: FileFormat<typeof messagesSchema> = {
  format: 'llsettings.messages',
  schema: messagesSchema,
  migrations: messagesMigrations,
};

/** `messages.json`: the 메시지 templates and the preset stage messages. */
export type MessagesFile = ReadonlyKnown<v.InferOutput<typeof messagesSchema>>;

/**
 * A 메시지 template. `{blank name}` in `text` marks a blank that the operator
 * fills when sending. `targets` and `duration` are the defaults for sending.
 */
export type MessageTemplate = MessagesFile['templates'][number];

export function parseMessages(
  text: string,
  file: string,
): Result<LoadedFile<MessagesFile>, FileError> {
  return parseFile(messagesFormat, text, file);
}

export function serializeMessages(
  messages: MessagesFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(messagesFormat, messages, file);
}
