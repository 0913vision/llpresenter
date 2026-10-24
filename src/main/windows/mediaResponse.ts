import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname} from 'node:path';
import {Readable} from 'node:stream';
import {mediaIdFromUrl} from '@shared/media';
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
 */
export async function createFileResponse(
  path: string,
  rangeHeader: string | null,
): Promise<Response> {
  const {size} = await stat(path);
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: HTTP_RANGE_NOT_SATISFIABLE,
      headers: {'Content-Range': `bytes */${size}`},
    });
  }
  const bytes = range ?? {start: 0, end: size - 1};
  const headers: Record<string, string> = {
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
  readonly log: Logger;
}

/**
 * Answers `llp-media:` requests with the library file of the media id. A URL
 * that isn't a media URL, an unknown id, a missing file, and a file outside
 * the media folders never throw; they get an error status, and all but the
 * first are logged.
 */
export function createMediaHandler({
  resolvePath,
  mediaRoots,
  log,
}: MediaHandlerOptions): (request: Request) => Promise<Response> {
  return async request => {
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
