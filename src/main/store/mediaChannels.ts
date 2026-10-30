import {ipcMain} from 'electron';
import {Channels} from '@contracts/ipc/api';
import {
  parseMediaEdit,
  parseMediaImportRequest,
  parseMediaImportResult,
  parseMediaEditResult,
  parseMediaImportProgress,
  type MediaEditResult,
  type MediaImportRequest,
  type MediaImportResult,
} from '@core/schema/mediaEdit';
import type {MediaId} from '@core/schema/ids';
import type {Logger} from '../log';
import {broadcast} from './contentChannels';
import {mediaRefusal} from './mediaEdits';
import type {MediaStore} from './mediaStore';

/** P6a owns copying, analysis, dialogs, and jobs; disconnect and shutdown abort its signal. */
export interface MediaBackend {
  import(request: MediaImportRequest, signal: AbortSignal): Promise<unknown>;
  relink(mediaId: MediaId, signal: AbortSignal): Promise<unknown>;
  cancel(mediaId: MediaId, signal: AbortSignal): Promise<unknown>;
}

/** P6a attaches one backend and sends schema-checked progress through this main-side port. */
export interface MediaBackendPort {
  connect(backend: MediaBackend): MediaBackendConnection;
}

export interface MediaBackendConnection {
  report(progress: unknown): boolean;
  disconnect(): void;
}

const UNAVAILABLE = mediaRefusal(
  'not-found',
  'Media operations are unavailable until the media backend is connected',
);
const CLOSED = mediaRefusal('not-found', 'Media list is unavailable');
export const MAX_MEDIA_BACKEND_REQUESTS = 16;

interface ConnectedBackend {
  readonly handlers: MediaBackend;
  readonly abort: AbortController;
  pending: number;
}

/** Registers validated media IPC and exposes the P6a backend connection. */
export function registerMediaChannels(
  loading: Promise<MediaStore | null>,
  log: Logger,
) {
  let disposed = false;
  let backend: ConnectedBackend | null = null;
  let closing: Promise<void> | null = null;
  let remove: (() => void) | undefined;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open media channels', error);
    return null;
  });
  const subscription = ready.then(store => {
    if (!disposed && store !== null) {
      remove = store.subscribe(document =>
        broadcast(Channels.mediaChanged, document, log),
      );
    }
  });
  const port: MediaBackendPort = {
    connect: handlers => {
      if (disposed) throw new Error('Media list is unavailable');
      if (backend !== null) {
        throw new Error('A media backend is already connected');
      }
      const connection = {handlers, abort: new AbortController(), pending: 0};
      backend = connection;
      return {
        disconnect: () => {
          if (backend === connection) {
            backend = null;
            connection.abort.abort();
          }
        },
        report: progress => {
          if (disposed || backend !== connection) return false;
          const parsed = parseMediaImportProgress(progress);
          if (!parsed.ok) {
            log.warn('dropped malformed media import progress', parsed.error);
            return false;
          }
          broadcast(Channels.mediaImportChanged, parsed.value, log);
          return true;
        },
      };
    },
  };
  ipcMain.handle(Channels.mediaGet, async () => {
    const store = await ready;
    if (disposed || store === null) {
      throw new Error('Media list is unavailable');
    }
    return store.get();
  });
  ipcMain.handle(
    Channels.mediaEdit,
    async (_event, value: unknown): Promise<MediaEditResult> => {
      const parsed = parseMediaEdit(value);
      if (!parsed.ok) {
        log.warn('dropped a malformed media edit', parsed.error);
        return mediaRefusal('invalid', parsed.error.message);
      }
      const store = await ready;
      if (disposed || store === null) return CLOSED;
      const edit = parsed.value;
      if (edit.type !== 'media.relink' && edit.type !== 'media.import.cancel') {
        return store.apply(edit);
      }
      if (store.get().access === 'readOnly') {
        return mediaRefusal('read-only', 'A newer app version wrote this file');
      }
      const connection = backend;
      if (connection === null) return UNAVAILABLE;
      if (
        edit.type === 'media.relink' &&
        !store.get().value.items.some(item => item.id === edit.mediaId)
      ) {
        return mediaRefusal('not-found', 'This media no longer exists');
      }
      if (connection.pending >= MAX_MEDIA_BACKEND_REQUESTS) {
        return mediaRefusal('invalid', 'Too many pending media operations');
      }
      connection.pending++;
      try {
        const reply = await (edit.type === 'media.relink'
          ? connection.handlers.relink(edit.mediaId, connection.abort.signal)
          : connection.handlers.cancel(edit.mediaId, connection.abort.signal));
        if (connection.abort.signal.aborted) return CLOSED;
        const result = parseMediaEditResult(reply);
        if (result.ok) return result.value;
        log.warn('dropped a malformed media backend edit result', result.error);
        return mediaRefusal('invalid', 'Invalid media backend edit result');
      } catch (error: unknown) {
        log.error('media backend edit failed', error);
        return mediaRefusal('invalid', 'Media backend edit failed');
      } finally {
        connection.pending--;
      }
    },
  );
  ipcMain.handle(
    Channels.mediaImport,
    async (_event, value: unknown): Promise<MediaImportResult> => {
      const parsed = parseMediaImportRequest(value);
      if (!parsed.ok) {
        log.warn('dropped a malformed media import', parsed.error);
        return mediaRefusal('invalid', parsed.error.message);
      }
      const store = await ready;
      if (disposed || store === null) return CLOSED;
      if (store.get().access === 'readOnly') {
        return mediaRefusal('read-only', 'A newer app version wrote this file');
      }
      const connection = backend;
      if (connection === null) return UNAVAILABLE;
      if (connection.pending >= MAX_MEDIA_BACKEND_REQUESTS) {
        return mediaRefusal('invalid', 'Too many pending media operations');
      }
      connection.pending++;
      try {
        const reply = await connection.handlers.import(
          parsed.value,
          connection.abort.signal,
        );
        if (connection.abort.signal.aborted) return CLOSED;
        const result = parseMediaImportResult(reply);
        if (result.ok) return result.value;
        log.warn(
          'dropped a malformed media backend import result',
          result.error,
        );
        return mediaRefusal('invalid', 'Invalid media backend import result');
      } catch (error: unknown) {
        log.error('media backend import failed', error);
        return mediaRefusal('invalid', 'Media backend import failed');
      } finally {
        connection.pending--;
      }
    },
  );
  return {
    port,
    dispose: (): Promise<void> => {
      if (closing !== null) return closing;
      disposed = true;
      backend?.abort.abort();
      backend = null;
      for (const channel of [
        Channels.mediaGet,
        Channels.mediaEdit,
        Channels.mediaImport,
      ]) {
        ipcMain.removeHandler(channel);
      }
      remove?.();
      closing = (async () => {
        await subscription;
        await (await ready)?.dispose();
      })();
      return closing;
    },
  };
}
