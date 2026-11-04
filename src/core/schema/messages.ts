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
import {
  messageStyleIdSchema,
  messageTemplateIdSchema,
  screenIdSchema,
} from './ids';
import {textOutlineSchema, textShadowSchema} from './textEffects';
import type {MigrationStep} from './migration';
import {
  hexColor,
  jsonObject,
  listWithUniqueIds,
  percent,
  positiveInteger,
  seconds,
} from './primitives';
import {textStyleEntries} from './textStyle';

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

/** The most 메시지 styles a messages file holds. */
export const MESSAGE_STYLE_LIMIT = 1000;

const messageStyleSchema = jsonObject({
  id: messageStyleIdSchema,
  name: v.string(),
  ...textStyleEntries,
  maxLines: positiveInteger,
  margin: percent,
  outline: textOutlineSchema,
  shadow: textShadowSchema,
  background: v.exactOptional(jsonObject({color: hexColor, opacity: percent})),
});

export const messagesSchema = jsonObject({
  format: v.literal('llsettings.messages'),
  schemaVersion: positiveInteger,
  templates: listWithUniqueIds(templateSchema),
  messageStyles: v.exactOptional(
    v.pipe(
      v.array(messageStyleSchema),
      v.maxLength(MESSAGE_STYLE_LIMIT),
      v.check(
        items => new Set(items.map(item => item.id)).size === items.length,
        'Another style already has this id',
      ),
    ),
  ),
});

const messagesMigrations: readonly MigrationStep[] = [];

const messagesFormat: FileFormat<typeof messagesSchema> = {
  format: 'llsettings.messages',
  schema: messagesSchema,
  migrations: messagesMigrations,
};

/** `messages.json`: the 메시지 문구 and styles. */
export type MessagesFile = ReadonlyKnown<v.InferOutput<typeof messagesSchema>>;

/**
 * A 메시지 문구. `{blank name}` in `text` marks a blank that the operator
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

/** How a 메시지 is drawn: one entry of `messageStyles`. */
export type MessageStyle = NonNullable<MessagesFile['messageStyles']>[number];

/** The dark translucent background of the built-in 기본 메시지 band. */
export const MESSAGE_BAND_BACKGROUND = {color: '#000000', opacity: 72} as const;

/**
 * The fixed appearance used before a screen chooses a message style: a band
 * across the top of the screen (user decision, November 3). The size is 5% of
 * the 1080-line reference screen.
 */
export const DEFAULT_MESSAGE_STYLE: MessageStyle = v.parse(messageStyleSchema, {
  id: '00000000-0000-4000-8000-000000000001',
  name: '기본',
  font: 'Pretendard',
  weight: 600,
  size: 54,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'top',
  lineHeight: 1.3,
  maxLines: 2,
  margin: 0,
  outline: {on: false, width: 3, color: '#000000'},
  shadow: {
    on: false,
    blur: 8,
    distance: 4,
    angle: 45,
    opacity: 60,
    color: '#000000',
  },
  background: MESSAGE_BAND_BACKGROUND,
});
