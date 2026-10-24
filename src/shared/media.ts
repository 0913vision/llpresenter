/** The privileged scheme that serves library media to windows by id. */
export const MEDIA_SCHEME = 'llp-media';

const MEDIA_HOST = 'media';
const MEDIA_PROTOCOL = `${MEDIA_SCHEME}:`;

/** The URL of a library media file: `llp-media://media/<encoded id>`. */
export function mediaUrl(mediaId: string): string {
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encodeURIComponent(mediaId)}`;
}

/** The media id in a media URL, or `null` when the URL isn't one. */
export function mediaIdFromUrl(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const {protocol, host, pathname, search, hash} = new URL(url);
  const encodedId = pathname.slice(1);
  if (
    protocol !== MEDIA_PROTOCOL ||
    host !== MEDIA_HOST ||
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
