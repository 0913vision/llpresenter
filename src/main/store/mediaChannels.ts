import {mediaEndpoints} from '@contracts/ipc/media';
import {
  parseMediaEditResult,
  parseMediaImportResult,
  type MediaEdit,
  type MediaEditResult,
  type MediaImportRequest,
  type MediaImportResult,
} from '@core/schema/mediaEdit';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {
  MEDIA_CLOSED,
  MediaBackendSlot,
  type MediaBackendPort,
} from './mediaBackend';
import {mediaRefusal} from './mediaEdits';
import type {MediaStore} from './mediaStore';

const READ_ONLY = mediaRefusal(
  'read-only',
  'A newer app version wrote this file',
);

function edit(
  store: MediaStore,
  change: MediaEdit,
  backend: MediaBackendSlot,
): MediaEditResult | Promise<MediaEditResult> {
  if (change.type !== 'media.relink' && change.type !== 'media.import.cancel') {
    return store.apply(change);
  }
  const {access, value} = store.get();
  if (access === 'readOnly') return READ_ONLY;
  if (
    change.type === 'media.relink' &&
    !value.items.some(item => item.id === change.mediaId)
  ) {
    return mediaRefusal('not-found', 'This media no longer exists');
  }
  return backend.call({
    name: 'edit',
    run: (connected, signal) =>
      change.type === 'media.relink'
        ? connected.relink(change.mediaId, signal)
        : connected.cancel(change.mediaId, signal),
    parse: parseMediaEditResult,
  });
}

function importFiles(
  store: MediaStore,
  request: MediaImportRequest,
  backend: MediaBackendSlot,
): MediaImportResult | Promise<MediaImportResult> {
  if (store.get().access === 'readOnly') return READ_ONLY;
  return backend.call({
    name: 'import',
    run: (connected, signal) => connected.import(request, signal),
    parse: parseMediaImportResult,
  });
}

/** Answers the reads and edits of the media list, and takes its backend. */
export function registerMediaChannels(
  loading: Promise<MediaStore | null>,
  log: Logger,
): {
  readonly port: MediaBackendPort;
  /** Stops answering, and waits until the store has saved what it took. */
  readonly dispose: () => Promise<void>;
} {
  const ipc = new IpcHost(log);
  const backend = new MediaBackendSlot(ipc, log);
  let disposed = false;
  let closing: Promise<void> | null = null;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open media channels', error);
    return null;
  });
  const open = async (): Promise<MediaStore | null> => {
    const store = await ready;
    return disposed ? null : store;
  };
  const following = open().then(store => {
    if (store === null) return;
    ipc.whenClosed(
      store.subscribe(document => ipc.push(mediaEndpoints.changed, document)),
    );
  });
  ipc.query(mediaEndpoints.get, async () => {
    const store = await open();
    if (store === null) throw new Error('Media list is unavailable');
    return store.get();
  });
  ipc.request(mediaEndpoints.edit, async change => {
    const store = await open();
    return store === null ? MEDIA_CLOSED : edit(store, change, backend);
  });
  ipc.request(mediaEndpoints.import, async request => {
    const store = await open();
    return store === null ? MEDIA_CLOSED : importFiles(store, request, backend);
  });
  const close = async (): Promise<void> => {
    await following;
    await (await ready)?.dispose();
  };
  return {
    port: backend,
    dispose: () => {
      if (closing !== null) return closing;
      disposed = true;
      backend.close();
      ipc.close();
      closing = close();
      return closing;
    },
  };
}
