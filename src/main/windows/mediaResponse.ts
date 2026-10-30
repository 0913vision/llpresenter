import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname} from 'node:path';
import {Readable} from 'node:stream';
import {
  analysisTokenFromUrl,
  mediaIdFromUrl,
  thumbnailIdFromUrl,
} from '@contracts/ipc/mediaUrls';
import type {Logger} from '../log';
import {realPathInside} from './insideRoots';

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const UNKNOWN_TYPE = 'application/octet-stream';

const HTTP_OK = 200;
const HTTP_PARTIAL = 206;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_RANGE_NOT_SATISFIABLE = 416;

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

type ResponseBody = ConstructorParameters<typeof Response>[0];

/** Bytes from `start` to `end`, both included. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Reads a single `Range: bytes=...` header. Video elements ask for one range
 * at a time; anything else gets the whole file.
 *
 * @returns The range, null for the whole file, or `unsatisfiable` for a range
 * outside the file.
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  const match = header === null ? null : SINGLE_RANGE.exec(header.trim());
  if (match === null) return null;
  const [, first = '', last = ''] = match;
  if (first === '' && last === '') return null;
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    return {start: Math.max(0, size - suffix), end: size - 1};
  }
  const start = Number(first);
  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return {start, end};
}

function mediaTypeOf(path: string): string {
  return MEDIA_TYPES[extname(path).toLowerCase()] ?? UNKNOWN_TYPE;
}

function fileBody(path: string, {start, end}: ByteRange): ResponseBody {
  if (end < start) return null;
  return Readable.toWeb(createReadStream(path, {start, end}));
}

/**
 * Answers a request for a file, with the part a `Range` header asks for, so
 * video elements can stream and seek.
 *
 * @param extraHeaders - Headers to add, such as CORS for the analysis page.
 */
export async function createFileResponse(
  path: string,
  rangeHeader: string | null,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Response> {
  const {size} = await stat(path);
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: HTTP_RANGE_NOT_SATISFIABLE,
      headers: {...extraHeaders, 'Content-Range': `bytes */${size}`},
    });
  }
  const bytes = range ?? {start: 0, end: size - 1};
  const headers: Record<string, string> = {
    ...extraHeaders,
    'Content-Type': mediaTypeOf(path),
    'Content-Length': String(bytes.end - bytes.start + 1),
    'Accept-Ranges': 'bytes',
  };
  if (range !== null) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  }
  return new Response(fileBody(path, bytes), {
    status: range === null ? HTTP_OK : HTTP_PARTIAL,
    headers,
  });
}

/** Finds the file of a library media item, or null when there is none. */
export type MediaPathResolver = (mediaId: string) => Promise<string | null>;

/** The arguments of {@link createMediaHandler}. */
export interface MediaHandlerOptions {
  readonly resolvePath: MediaPathResolver;
  /** The folders media files may come from. A file outside them is refused. */
  readonly mediaRoots: () => readonly string[];
  /**
   * The file main lent the analysis page under a token, or null. It is served
   * with CORS, so the page can draw it on a canvas, and without the media
   * folder check, because main chose the file.
   */
  readonly analysisFile?: (token: string) => string | null;
  /** A media item's thumbnail file, made when needed; null when it has none. */
  readonly thumbnail?: (mediaId: string) => Promise<string | null>;
  readonly log: Logger;
}

// NOTE(0913vision): A relinked file gets a new thumbnail at the same URL, so
// windows ask again instead of reusing what they have.
const THUMBNAIL_HEADERS = {'Cache-Control': 'no-cache'} as const;

async function serveThumbnail(
  mediaId: string,
  request: Request,
  {thumbnail, log}: MediaHandlerOptions,
): Promise<Response> {
  try {
    const path = (await thumbnail?.(mediaId)) ?? null;
    if (path === null) return new Response(null, {status: HTTP_NOT_FOUND});
    return await createFileResponse(
      path,
      request.headers.get('range'),
      THUMBNAIL_HEADERS,
    );
  } catch (error: unknown) {
    log.warn('could not serve a thumbnail', error);
    return new Response(null, {status: HTTP_NOT_FOUND});
  }
}

const ANALYSIS_HEADERS = {'Access-Control-Allow-Origin': '*'} as const;

async function serveAnalysisFile(
  token: string,
  request: Request,
  {analysisFile, log}: MediaHandlerOptions,
): Promise<Response> {
  const path = analysisFile?.(token) ?? null;
  if (path === null) {
    log.warn('no file for an analysis token');
    return new Response(null, {status: HTTP_NOT_FOUND});
  }
  try {
    return await createFileResponse(
      path,
      request.headers.get('range'),
      ANALYSIS_HEADERS,
    );
  } catch (error: unknown) {
    log.warn('could not serve a file for analysis', error);
    return new Response(null, {status: HTTP_NOT_FOUND});
  }
}

/**
 * Answers `llp-media:` requests with the library file of the media id, or the
 * file lent to the analysis page. A URL that isn't a media URL, an unknown id
 * or token, a missing file, and a file outside the media folders never throw;
 * they get an error status, and all but the first are logged.
 */
export function createMediaHandler(
  options: MediaHandlerOptions,
): (request: Request) => Promise<Response> {
  const {resolvePath, mediaRoots, log} = options;
  return async request => {
    const token = analysisTokenFromUrl(request.url);
    if (token !== null) return serveAnalysisFile(token, request, options);
    const thumbnailId = thumbnailIdFromUrl(request.url);
    if (thumbnailId !== null) {
      return serveThumbnail(thumbnailId, request, options);
    }
    const mediaId = mediaIdFromUrl(request.url);
    if (mediaId === null) return new Response(null, {status: HTTP_BAD_REQUEST});
    try {
      const path = await resolvePath(mediaId);
      if (path === null) {
        log.warn('no file for a media id', {mediaId});
        return new Response(null, {status: HTTP_NOT_FOUND});
      }
      const allowed = await realPathInside(path, mediaRoots());
      if (allowed === null) {
        log.warn('no media file inside the media folders for a media id', {
          mediaId,
        });
        return new Response(null, {status: HTTP_NOT_FOUND});
      }
      return await createFileResponse(allowed, request.headers.get('range'));
    } catch (error) {
      log.warn(`could not serve the media file of ${mediaId}`, error);
      return new Response(null, {status: HTTP_NOT_FOUND});
    }
  };
}
