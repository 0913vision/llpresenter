import {protocol} from 'electron';
import {MEDIA_SCHEME} from '@shared/media';
import {createMediaHandler, type MediaHandlerOptions} from './mediaResponse';

/**
 * Lets the media scheme stream video and audio to windows. Electron accepts
 * this only before the app is ready.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {standard: true, secure: true, stream: true},
    },
  ]);
}

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
