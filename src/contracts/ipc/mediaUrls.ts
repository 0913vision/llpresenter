/** The privileged scheme that serves library media to windows by id. */
export const MEDIA_SCHEME = 'llp-media';

const MEDIA_HOST = 'media';
const ANALYSIS_HOST = 'analysis';
const THUMBNAIL_HOST = 'thumbnail';
const MEDIA_PROTOCOL = `${MEDIA_SCHEME}:`;

/** The URL of a library media file: `llp-media://media/<encoded id>`. */
export function mediaUrl(mediaId: string): string {
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encodeURIComponent(mediaId)}`;
}

/**
 * The URL the media analysis page reads one file from, by a token main hands
 * out for that file only: `llp-media://analysis/<encoded token>`.
 */
export function analysisUrl(token: string): string {
  return `${MEDIA_SCHEME}://${ANALYSIS_HOST}/${encodeURIComponent(token)}`;
}

/**
 * The URL of a media item's tile thumbnail, which main makes on the first
 * request: `llp-media://thumbnail/<encoded id>`. Audio has none (404). With a
 * revision (`?v=<hex>`, from `thumbnailRevision`) main lets the window keep
 * the picture for good, because a changed file has a new revision and so a
 * new URL; without one the window asks again each time.
 */
export function thumbnailUrl(mediaId: string, revision?: string): string {
  const base = `${MEDIA_SCHEME}://${THUMBNAIL_HOST}/${encodeURIComponent(mediaId)}`;
  return revision === undefined ? base : `${base}?v=${revision}`;
}

const REVISION_QUERY = /^\?v=([0-9a-f]{1,16})$/;

/** The revision in a thumbnail URL, or `null` when it has none. */
export function thumbnailRevisionFromUrl(url: string): string | null {
  if (thumbnailIdFromUrl(url) === null) return null;
  return REVISION_QUERY.exec(new URL(url).search)?.[1] ?? null;
}

/** The media id in a thumbnail URL, or `null` when the URL isn't one. */
export function thumbnailIdFromUrl(url: string): string | null {
  return idFromUrl(url, THUMBNAIL_HOST, true);
}

/** The media id in a media URL, or `null` when the URL isn't one. */
export function mediaIdFromUrl(url: string): string | null {
  return idFromUrl(url, MEDIA_HOST);
}

/** The token in an analysis URL, or `null` when the URL isn't one. */
export function analysisTokenFromUrl(url: string): string | null {
  return idFromUrl(url, ANALYSIS_HOST);
}

function idFromUrl(
  url: string,
  expectedHost: string,
  revisioned = false,
): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const {protocol, host, pathname, search, hash} = new URL(url);
  const encodedId = pathname.slice(1);
  if (
    protocol !== MEDIA_PROTOCOL ||
    host !== expectedHost ||
    !(search === '' || (revisioned && REVISION_QUERY.test(search))) ||
    hash !== '' ||
    encodedId === '' ||
    encodedId.includes('/')
  ) {
    return null;
  }
  return decodeMediaId(encodedId);
}

function decodeMediaId(encodedId: string): string | null {
  try {
    return decodeURIComponent(encodedId);
  } catch (error: unknown) {
    if (error instanceof URIError) {
      return null;
    }
    throw error;
  }
}
