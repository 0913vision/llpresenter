import {protocol} from 'electron';
import {MEDIA_SCHEME} from '@contracts/ipc/mediaUrls';
import {createMediaHandler, type MediaHandlerOptions} from './mediaResponse';

/**
 * Serves library media to windows by id. Call it after the app is ready.
 *
 * @returns A function that stops serving.
 */
export function serveMedia(options: MediaHandlerOptions): () => void {
  protocol.handle(MEDIA_SCHEME, createMediaHandler(options));
  return () => {
    protocol.unhandle(MEDIA_SCHEME);
  };
}
