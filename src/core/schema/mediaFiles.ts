import * as v from 'valibot';
import {mediaIdSchema} from './ids';
import {MEDIA_LIMITS} from './mediaList';
import {parsePayload, payloadObject} from './payload';

const missingMediaSchema = v.pipe(
  v.array(mediaIdSchema),
  v.maxLength(MEDIA_LIMITS.items),
);

const mediaStampsSchema = v.pipe(
  v.record(mediaIdSchema, v.pipe(v.number(), v.integer(), v.minValue(0))),
  v.maxEntries(MEDIA_LIMITS.items),
);

const mediaCheckSchema = payloadObject({mediaId: mediaIdSchema});

/**
 * The media whose file main can't find now, in media list order (spec 08,
 * "Missing media file"): pushed on `media:missing` whenever it changes, and
 * read on `media:missing:get`.
 */
export type MissingMedia = Readonly<v.InferOutput<typeof missingMediaSchema>>;

/**
 * When each media file was last changed, in milliseconds, for the items whose
 * file main could read: pushed on `media:stamps` whenever it changes, and read
 * on `media:stamps:get`. A window puts it in the thumbnail address, so a file
 * replaced by one of the same size gets a new thumbnail.
 */
export type MediaStamps = Readonly<v.InferOutput<typeof mediaStampsSchema>>;

/** Checks a `media:stamps` push or `media:stamps:get` reply. Never throws. */
export function parseMediaStamps(value: unknown) {
  return parsePayload(mediaStampsSchema, value);
}

/** A window's request to check one media file again, as after it failed to play. */
export type MediaCheckRequest = Readonly<
  v.InferOutput<typeof mediaCheckSchema>
>;

/** Checks a `media:missing` push or `media:missing:get` reply. Never throws. */
export function parseMissingMedia(value: unknown) {
  return parsePayload(missingMediaSchema, value);
}

/** Checks a `media:check` request. Unknown fields are dropped. Never throws. */
export function parseMediaCheckRequest(value: unknown) {
  return parsePayload(mediaCheckSchema, value);
}

/** A window's request to show one media file in Explorer (파일 위치 열기). */
export type MediaRevealRequest = MediaCheckRequest;

/** Checks a `media:reveal` request. Unknown fields are dropped. Never throws. */
export function parseMediaRevealRequest(value: unknown) {
  return parsePayload(mediaCheckSchema, value);
}
