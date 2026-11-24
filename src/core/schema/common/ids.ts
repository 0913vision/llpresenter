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

/**
 * The schema of a `SongId`: a lowercase UUID v4 with a brand. The other id
 * schemas below are the same for their own kinds.
 */
export const songIdSchema = uuidId('SongId');
export const serviceIdSchema = uuidId('ServiceId');
export const templateIdSchema = uuidId('TemplateId');
export const serviceItemIdSchema = uuidId('ServiceItemId');
export const slideIdSchema = uuidId('SlideId');
export const mediaIdSchema = uuidId('MediaId');
export const messageIdSchema = uuidId('MessageId');
export const screenIdSchema = uuidId('ScreenId');
export const macroCollectionIdSchema = uuidId('MacroCollectionId');
export const themeIdSchema = uuidId('ThemeId');
export const themeElementIdSchema = uuidId('ThemeElementId');
export const itemOverlayIdSchema = uuidId('ItemOverlayId');
export const messageStyleIdSchema = uuidId('MessageStyleId');
export const mediaPlaylistIdSchema = uuidId('MediaPlaylistId');
export const audioPlaylistIdSchema = uuidId('AudioPlaylistId');
export const macroIdSchema = uuidId('MacroId');
export const propIdSchema = uuidId('PropId');
export const timerIdSchema = uuidId('TimerId');
export const messageTemplateIdSchema = uuidId('MessageTemplateId');
export const quickItemIdSchema = uuidId('QuickItemId');
export const appFlushRequestIdSchema = uuidId('AppFlushRequestId');

/** Bible translation ids name a bundled or added file, so they aren't UUIDs. */
export const translationIdSchema = v.pipe(
  nonBlankText,
  v.brand('TranslationId'),
);

/** The id of a song, the name of its `Songs/<id>.llsong` file. */
export type SongId = v.InferOutput<typeof songIdSchema>;
/** The id of a 예배 순서, the name of its `Services/<id>.llservice` file. */
export type ServiceId = v.InferOutput<typeof serviceIdSchema>;
/**
 * The id of a service template, the name of its `Templates/<id>.llservice`
 * file.
 */
export type TemplateId = v.InferOutput<typeof templateIdSchema>;
/** The id of one item of a 예배 순서. */
export type ServiceItemId = v.InferOutput<typeof serviceItemIdSchema>;
/** The id of a slide. */
export type SlideId = v.InferOutput<typeof slideIdSchema>;
/** The id of a media file in the media library. */
export type MediaId = v.InferOutput<typeof mediaIdSchema>;
/** The id of one active message, apart from its saved template. */
export type MessageId = v.InferOutput<typeof messageIdSchema>;
/** The id of a screen, an entry of the `screens.json` list. */
export type ScreenId = v.InferOutput<typeof screenIdSchema>;
/** The id of a macro collection of `macros.json`. */
export type MacroCollectionId = v.InferOutput<typeof macroCollectionIdSchema>;
/** The id of a theme, an entry of `themes.json`. */
export type ThemeId = v.InferOutput<typeof themeIdSchema>;
/** The id of one element of a theme. */
export type ThemeElementId = v.InferOutput<typeof themeElementIdSchema>;
/** The id of an overlay of a service item. */
export type ItemOverlayId = v.InferOutput<typeof itemOverlayIdSchema>;

/** Brands a generated theme UUID; throws unless it is lowercase version 4. */
export function createThemeId(uuid: string): ThemeId {
  return v.parse(themeIdSchema, uuid);
}

/**
 * Brands a generated theme element UUID; throws unless it is lowercase version
 * 4.
 */
export function createThemeElementId(uuid: string): ThemeElementId {
  return v.parse(themeElementIdSchema, uuid);
}

/** Brands a generated overlay UUID; throws unless it is lowercase version 4. */
export function createItemOverlayId(uuid: string): ItemOverlayId {
  return v.parse(itemOverlayIdSchema, uuid);
}
/** The id of a message style of `messages.json`. */
export type MessageStyleId = v.InferOutput<typeof messageStyleIdSchema>;
/** The id of a media playlist of `media.json`. */
export type MediaPlaylistId = v.InferOutput<typeof mediaPlaylistIdSchema>;
/** The id of an audio playlist of `media.json`. */
export type AudioPlaylistId = v.InferOutput<typeof audioPlaylistIdSchema>;
/** The id of a macro of `macros.json`. */
export type MacroId = v.InferOutput<typeof macroIdSchema>;
/** The id of a 그래픽 of `props.json`. */
export type PropId = v.InferOutput<typeof propIdSchema>;
/** The id of a 타이머 of `timers.json`. */
export type TimerId = v.InferOutput<typeof timerIdSchema>;
/** The id of a saved message template of `messages.json`. */
export type MessageTemplateId = v.InferOutput<typeof messageTemplateIdSchema>;
/** The id of an item of `quick.json`. */
export type QuickItemId = v.InferOutput<typeof quickItemIdSchema>;
/** The id that ties a flush answer to its request. */
export type AppFlushRequestId = v.InferOutput<typeof appFlushRequestIdSchema>;

/** Checks a generated screen UUID without throwing. */
export function parseScreenId(value: unknown) {
  return parsePayload(screenIdSchema, value);
}

/** Brands a generated screen UUID; throws unless it is lowercase version 4. */
export function createScreenId(uuid: string): ScreenId {
  return v.parse(screenIdSchema, uuid);
}
/** The id of a Bible translation: the name of its bundled or added file. */
export type TranslationId = v.InferOutput<typeof translationIdSchema>;

/** The id of the built-in 개역개정 translation that is shown live. */
export const LIVE_BIBLE_ID = v.parse(translationIdSchema, 'bsk-gae');

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

/**
 * Brands a generated quick item UUID; throws unless it is lowercase version 4.
 */
export function createQuickItemId(uuid: string): QuickItemId {
  return v.parse(quickItemIdSchema, uuid);
}

/** Brands a generated timer UUID; throws unless it is lowercase version 4. */
export function createTimerId(uuid: string): TimerId {
  return v.parse(timerIdSchema, uuid);
}

/**
 * Brands a generated message template UUID; throws unless it is lowercase
 * version 4.
 */
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

/** Brands a generated slide UUID; throws unless it is lowercase version 4. */
export function createSlideId(uuid: string): SlideId {
  return v.parse(slideIdSchema, uuid);
}

/** Checks a service item ID received from a view without throwing. */
export function parseServiceItemId(value: unknown) {
  return parsePayload(serviceItemIdSchema, value);
}

/** Checks a macro collection id received from a view without throwing. */
export function parseMacroCollectionId(value: unknown) {
  return parsePayload(macroCollectionIdSchema, value);
}

/** Checks a macro id received from a view without throwing. */
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

/** Brands a generated prop UUID; throws unless it is lowercase version 4. */
export function createPropId(uuid: string): PropId {
  return v.parse(propIdSchema, uuid);
}

/** Brands the UUID of one active message, separately from a saved template. */
export function createMessageId(uuid: string): MessageId {
  return v.parse(messageIdSchema, uuid);
}

/**
 * Brands a generated media playlist UUID; throws unless it is lowercase version
 * 4.
 */
export function createMediaPlaylistId(uuid: string): MediaPlaylistId {
  return v.parse(mediaPlaylistIdSchema, uuid);
}

/**
 * Brands a generated audio playlist UUID; throws unless it is lowercase version
 * 4.
 */
export function createAudioPlaylistId(uuid: string): AudioPlaylistId {
  return v.parse(audioPlaylistIdSchema, uuid);
}

/** Brands a new flush-handshake UUID; throws unless it is lowercase version 4. */
export function createAppFlushRequestId(uuid: string): AppFlushRequestId {
  return v.parse(appFlushRequestIdSchema, uuid);
}
