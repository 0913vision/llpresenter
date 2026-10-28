import * as v from 'valibot';
import {nonBlankText} from './primitives';
import {parsePayload} from './payload';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const uuidV4 = v.pipe(
  v.string(),
  v.regex(UUID_V4, 'Expected a lowercase UUID v4'),
);

function uuidId<TBrand extends string>(brand: TBrand) {
  return v.pipe(uuidV4, v.brand(brand));
}

export const songIdSchema = uuidId('SongId');
export const songGroupIdSchema = uuidId('SongGroupId');
export const serviceIdSchema = uuidId('ServiceId');
export const templateIdSchema = uuidId('TemplateId');
export const serviceItemIdSchema = uuidId('ServiceItemId');
export const mediaIdSchema = uuidId('MediaId');
export const messageIdSchema = uuidId('MessageId');
export const noticeSetIdSchema = uuidId('NoticeSetId');
export const screenIdSchema = uuidId('ScreenId');
export const macroCollectionIdSchema = uuidId('MacroCollectionId');
export const lookIdSchema = uuidId('LookId');
export const lyricStyleIdSchema = uuidId('LyricStyleId');
export const messageStyleIdSchema = uuidId('MessageStyleId');
export const stageLayoutIdSchema = uuidId('StageLayoutId');
export const mediaPlaylistIdSchema = uuidId('MediaPlaylistId');
export const audioPlaylistIdSchema = uuidId('AudioPlaylistId');
export const macroIdSchema = uuidId('MacroId');
export const propIdSchema = uuidId('PropId');
export const timerIdSchema = uuidId('TimerId');
export const messageTemplateIdSchema = uuidId('MessageTemplateId');
export const quickItemIdSchema = uuidId('QuickItemId');
export const appFlushRequestIdSchema = uuidId('AppFlushRequestId');

/** Stage layout elements are named within their layout, so they aren't UUIDs. */
export const stageElementIdSchema = v.pipe(
  nonBlankText,
  v.brand('StageElementId'),
);

/** Bible translation ids name a bundled or added file, so they aren't UUIDs. */
export const translationIdSchema = v.pipe(
  nonBlankText,
  v.brand('TranslationId'),
);

export type SongId = v.InferOutput<typeof songIdSchema>;
export type SongGroupId = v.InferOutput<typeof songGroupIdSchema>;
export type ServiceId = v.InferOutput<typeof serviceIdSchema>;
export type TemplateId = v.InferOutput<typeof templateIdSchema>;
export type ServiceItemId = v.InferOutput<typeof serviceItemIdSchema>;
export type MediaId = v.InferOutput<typeof mediaIdSchema>;
export type MessageId = v.InferOutput<typeof messageIdSchema>;
export type NoticeSetId = v.InferOutput<typeof noticeSetIdSchema>;
export type ScreenId = v.InferOutput<typeof screenIdSchema>;
export type MacroCollectionId = v.InferOutput<typeof macroCollectionIdSchema>;
export type LookId = v.InferOutput<typeof lookIdSchema>;
export type LyricStyleId = v.InferOutput<typeof lyricStyleIdSchema>;
export type MessageStyleId = v.InferOutput<typeof messageStyleIdSchema>;
export type StageLayoutId = v.InferOutput<typeof stageLayoutIdSchema>;
export type MediaPlaylistId = v.InferOutput<typeof mediaPlaylistIdSchema>;
export type AudioPlaylistId = v.InferOutput<typeof audioPlaylistIdSchema>;
export type MacroId = v.InferOutput<typeof macroIdSchema>;
export type PropId = v.InferOutput<typeof propIdSchema>;
export type TimerId = v.InferOutput<typeof timerIdSchema>;
export type MessageTemplateId = v.InferOutput<typeof messageTemplateIdSchema>;
export type QuickItemId = v.InferOutput<typeof quickItemIdSchema>;
export type AppFlushRequestId = v.InferOutput<typeof appFlushRequestIdSchema>;

/** Checks a generated screen UUID without throwing. */
export function parseScreenId(value: unknown) {
  return parsePayload(screenIdSchema, value);
}
export type StageElementId = v.InferOutput<typeof stageElementIdSchema>;
export type TranslationId = v.InferOutput<typeof translationIdSchema>;

/** Validates a main-process Look selection without throwing. UUIDs are exactly 36 characters. */
export function parseLookId(value: unknown) {
  return parsePayload(lookIdSchema, value);
}

/** Checks a generated lyric style UUID without throwing. */
export function parseLyricStyleId(value: unknown) {
  return parsePayload(lyricStyleIdSchema, value);
}

/** Checks a message style ID received from a view. */
export function parseMessageStyleId(value: unknown) {
  return parsePayload(messageStyleIdSchema, value);
}

/** Brands a generated message style UUID. */
export function createMessageStyleId(uuid: string): MessageStyleId {
  return v.parse(messageStyleIdSchema, uuid);
}

/** Brands a generated song UUID; throws unless it is lowercase version 4. */
export function createSongId(uuid: string): SongId {
  return v.parse(songIdSchema, uuid);
}

/** Brands a generated group UUID, scoped to its song. */
export function createSongGroupId(uuid: string): SongGroupId {
  return v.parse(songGroupIdSchema, uuid);
}

export function createQuickItemId(uuid: string): QuickItemId {
  return v.parse(quickItemIdSchema, uuid);
}

export function createTimerId(uuid: string): TimerId {
  return v.parse(timerIdSchema, uuid);
}

export function createMessageTemplateId(uuid: string): MessageTemplateId {
  return v.parse(messageTemplateIdSchema, uuid);
}

/** Brands a generated service UUID; throws unless it is lowercase version 4. */
export function createServiceId(uuid: string): ServiceId {
  return v.parse(serviceIdSchema, uuid);
}

/** Brands a generated template UUID; throws unless it is lowercase version 4. */
export function createTemplateId(uuid: string): TemplateId {
  return v.parse(templateIdSchema, uuid);
}

/** Brands a generated item UUID; throws unless it is lowercase version 4. */
export function createServiceItemId(uuid: string): ServiceItemId {
  return v.parse(serviceItemIdSchema, uuid);
}

/** Checks a service item ID received from a view without throwing. */
export function parseServiceItemId(value: unknown) {
  return parsePayload(serviceItemIdSchema, value);
}

export function parseMacroCollectionId(value: unknown) {
  return parsePayload(macroCollectionIdSchema, value);
}

export function parseMacroId(value: unknown) {
  return parsePayload(macroIdSchema, value);
}

/** Checks a media ID from a URL or a file name without throwing. */
export function parseMediaId(value: unknown) {
  return parsePayload(mediaIdSchema, value);
}

/** Brands a reserved media or copy-job UUID; throws unless it is version 4. */
export function createMediaId(uuid: string): MediaId {
  return v.parse(mediaIdSchema, uuid);
}

/** Brands a generated notice set UUID; throws unless it is lowercase version 4. */
export function createNoticeSetId(uuid: string): NoticeSetId {
  return v.parse(noticeSetIdSchema, uuid);
}

/** Brands a generated prop UUID; throws unless it is lowercase version 4. */
export function createPropId(uuid: string): PropId {
  return v.parse(propIdSchema, uuid);
}

/** Brands the UUID of one active message, separately from a saved template. */
export function createMessageId(uuid: string): MessageId {
  return v.parse(messageIdSchema, uuid);
}

export function createMediaPlaylistId(uuid: string): MediaPlaylistId {
  return v.parse(mediaPlaylistIdSchema, uuid);
}

export function createAudioPlaylistId(uuid: string): AudioPlaylistId {
  return v.parse(audioPlaylistIdSchema, uuid);
}

/** Brands a new flush-handshake UUID; throws unless it is lowercase version 4. */
export function createAppFlushRequestId(uuid: string): AppFlushRequestId {
  return v.parse(appFlushRequestIdSchema, uuid);
}
