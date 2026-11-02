import * as v from 'valibot';
import {mediaIdSchema} from './ids';
import {parsePayload, payloadObject} from './payload';
import {nonNegativeInteger} from './primitives';

const mediaUsesRequestSchema = payloadObject({mediaId: mediaIdSchema});

const mediaUsesSchema = payloadObject({
  playlists: nonNegativeInteger,
  notices: nonNegativeInteger,
  graphics: nonNegativeInteger,
  songBackgrounds: nonNegativeInteger,
  serviceItems: nonNegativeInteger,
  itemOverlays: nonNegativeInteger,
  themes: nonNegativeInteger,
  macros: nonNegativeInteger,
});

/** A window's request for the places that use one media item. */
export type MediaUsesRequest = Readonly<
  v.InferOutput<typeof mediaUsesRequestSchema>
>;

/**
 * How many places use a media item (spec 08, "Deleting a media item that is
 * in use"): 재생목록, 공지 세트, 그래픽, 곡 배경, and 예배 순서 항목 (an item's
 * own background, or a media item), 항목 오버레이, 테마 (an image element),
 * and 매크로 (a media or audio action).
 */
export type MediaUses = Readonly<v.InferOutput<typeof mediaUsesSchema>>;

/** Checks a `media:uses` request. Unknown fields are dropped. Never throws. */
export function parseMediaUsesRequest(value: unknown) {
  return parsePayload(mediaUsesRequestSchema, value);
}

/** Checks a `media:uses` reply. Never throws. */
export function parseMediaUses(value: unknown) {
  return parsePayload(mediaUsesSchema, value);
}
