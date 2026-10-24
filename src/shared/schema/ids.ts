import * as v from 'valibot';
import {nonBlankText} from './primitives';

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
export const serviceIdSchema = uuidId('ServiceId');
export const templateIdSchema = uuidId('TemplateId');
export const serviceItemIdSchema = uuidId('ServiceItemId');
export const mediaIdSchema = uuidId('MediaId');
export const noticeSetIdSchema = uuidId('NoticeSetId');
export const screenIdSchema = uuidId('ScreenId');
export const macroCollectionIdSchema = uuidId('MacroCollectionId');
export const lookIdSchema = uuidId('LookId');
export const lyricStyleIdSchema = uuidId('LyricStyleId');
export const stageLayoutIdSchema = uuidId('StageLayoutId');
export const mediaPlaylistIdSchema = uuidId('MediaPlaylistId');
export const audioPlaylistIdSchema = uuidId('AudioPlaylistId');
export const macroIdSchema = uuidId('MacroId');
export const propIdSchema = uuidId('PropId');
export const timerIdSchema = uuidId('TimerId');
export const messageTemplateIdSchema = uuidId('MessageTemplateId');
export const quickItemIdSchema = uuidId('QuickItemId');

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
export type ServiceId = v.InferOutput<typeof serviceIdSchema>;
export type TemplateId = v.InferOutput<typeof templateIdSchema>;
export type ServiceItemId = v.InferOutput<typeof serviceItemIdSchema>;
export type MediaId = v.InferOutput<typeof mediaIdSchema>;
export type NoticeSetId = v.InferOutput<typeof noticeSetIdSchema>;
export type ScreenId = v.InferOutput<typeof screenIdSchema>;
export type MacroCollectionId = v.InferOutput<typeof macroCollectionIdSchema>;
export type LookId = v.InferOutput<typeof lookIdSchema>;
export type LyricStyleId = v.InferOutput<typeof lyricStyleIdSchema>;
export type StageLayoutId = v.InferOutput<typeof stageLayoutIdSchema>;
export type MediaPlaylistId = v.InferOutput<typeof mediaPlaylistIdSchema>;
export type AudioPlaylistId = v.InferOutput<typeof audioPlaylistIdSchema>;
export type MacroId = v.InferOutput<typeof macroIdSchema>;
export type PropId = v.InferOutput<typeof propIdSchema>;
export type TimerId = v.InferOutput<typeof timerIdSchema>;
export type MessageTemplateId = v.InferOutput<typeof messageTemplateIdSchema>;
export type QuickItemId = v.InferOutput<typeof quickItemIdSchema>;
export type StageElementId = v.InferOutput<typeof stageElementIdSchema>;
export type TranslationId = v.InferOutput<typeof translationIdSchema>;
