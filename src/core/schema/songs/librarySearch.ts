import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {parsePayload, payloadObject, plainObject} from '../common/payload';
import {songIdSchema} from '../common/ids';
import {nonNegativeInteger, positiveInteger} from '../common/primitives';

/**
 * The 라이브러리 search's `limit`: 50 when absent, at most 200, which is also the
 * most matches in a result.
 */
export const LIBRARY_SEARCH_LIMITS = {default: 50, max: 200} as const;

const librarySearchRequestSchema = payloadObject({
  query: v.string(),
  offset: v.exactOptional(
    v.pipe(nonNegativeInteger, v.maxValue(Number.MAX_SAFE_INTEGER)),
  ),
  limit: v.exactOptional(
    v.pipe(positiveInteger, v.maxValue(LIBRARY_SEARCH_LIMITS.max)),
    LIBRARY_SEARCH_LIMITS.default,
  ),
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
    v.maxLength(LIBRARY_SEARCH_LIMITS.max),
    v.check(
      matches =>
        new Set(matches.map(({songId}) => songId)).size === matches.length,
      'Another search match already has this song id',
    ),
  ),
});

/**
 * A query for the main-owned index. An absent limit defaults to 50, with a
 * maximum of 200. Main normalizes queries and sorts all matches by title.
 */
type NormalizedSearchRequest = Readonly<
  v.InferOutput<typeof librarySearchRequestSchema>
>;

/**
 * A 라이브러리 search: the `query`, an optional `offset`, and an optional `limit`.
 */
export type LibrarySearchRequest = Omit<NormalizedSearchRequest, 'limit'> &
  Partial<Pick<NormalizedSearchRequest, 'limit'>>;

/** A lyrics match carries its first matching line, before normalization. */
export type LibrarySearchMatch = ReadonlyKnown<
  v.InferOutput<typeof librarySearchMatchSchema>
>;

/** The echoed query lets a window ignore an older asynchronous response. */
export type LibrarySearchResult = ReadonlyKnown<
  v.InferOutput<typeof librarySearchResultSchema>
>;

/** Checks a 라이브러리 search request. */
export function parseLibrarySearchRequest(value: unknown) {
  return parsePayload(librarySearchRequestSchema, value);
}

/** Checks a 라이브러리 search result: no song appears twice. */
export function parseLibrarySearchResult(value: unknown) {
  return parsePayload(librarySearchResultSchema, value);
}
