import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {parsePayload, payloadObject, plainObject} from './payload';
import {songIdSchema} from './ids';
import {nonNegativeInteger, positiveInteger} from './primitives';

const librarySearchRequestSchema = payloadObject({
  query: v.string(),
  limit: v.exactOptional(positiveInteger),
});

const librarySearchMatchSchema = payloadObject({
  songId: songIdSchema,
  title: v.string(),
  slideCount: nonNegativeInteger,
  match: v.pipe(
    plainObject,
    v.variant('kind', [
      v.object({kind: v.literal('title')}),
      v.object({kind: v.literal('lyrics'), line: v.string()}),
    ]),
  ),
});

const librarySearchResultSchema = payloadObject({
  query: v.string(),
  matches: v.pipe(
    v.array(librarySearchMatchSchema),
    v.check(
      matches =>
        new Set(matches.map(({songId}) => songId)).size === matches.length,
      'Another search match already has this song id',
    ),
  ),
});

/**
 * A query for the main-owned index. An absent limit returns all matches;
 * toolbar callers use 20. Main owns normalization and title-first ordering.
 */
export type LibrarySearchRequest = Readonly<
  v.InferOutput<typeof librarySearchRequestSchema>
>;

/** A lyrics match carries its first matching line, before normalization. */
export type LibrarySearchMatch = ReadonlyKnown<
  v.InferOutput<typeof librarySearchMatchSchema>
>;

/** The echoed query lets a window ignore an older asynchronous response. */
export type LibrarySearchResult = ReadonlyKnown<
  v.InferOutput<typeof librarySearchResultSchema>
>;

export function parseLibrarySearchRequest(value: unknown) {
  return parsePayload(librarySearchRequestSchema, value);
}

export function parseLibrarySearchResult(value: unknown) {
  return parsePayload(librarySearchResultSchema, value);
}
