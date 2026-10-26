/** The privileged scheme that serves library media to windows by id. */
export const MEDIA_SCHEME = 'llp-media';

const MEDIA_HOST = 'media';
const ANALYSIS_HOST = 'analysis';
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

/** The media id in a media URL, or `null` when the URL isn't one. */
export function mediaIdFromUrl(url: string): string | null {
  return idFromUrl(url, MEDIA_HOST);
}

/** The token in an analysis URL, or `null` when the URL isn't one. */
export function analysisTokenFromUrl(url: string): string | null {
  return idFromUrl(url, ANALYSIS_HOST);
}

function idFromUrl(url: string, expectedHost: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const {protocol, host, pathname, search, hash} = new URL(url);
  const encodedId = pathname.slice(1);
  if (
    protocol !== MEDIA_PROTOCOL ||
    host !== expectedHost ||
    search !== '' ||
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
