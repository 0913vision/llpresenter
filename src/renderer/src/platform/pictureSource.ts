import {mediaIdFromUrl, thumbnailIdFromUrl} from '@contracts/ipc/mediaUrls';

/** Reads only library picture URLs; remote addresses and redirects are refused. */
export async function readPictureSource(
  source: string,
  method: 'GET' | 'HEAD' = 'GET',
): Promise<Response> {
  if (mediaIdFromUrl(source) === null && thumbnailIdFromUrl(source) === null) {
    throw new Error('Invalid local picture source');
  }
  const response = await fetch(source, {
    method,
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Could not read local picture source');
  return response;
}
