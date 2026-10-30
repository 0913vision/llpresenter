import {BrowserWindow, ipcMain} from 'electron';
import {contentEndpoints} from '@contracts/ipc/content';
import type {Result} from '@core/common/result';
import {
  parseContentEdit,
  refuseInvalidEdit,
  type EditResult,
} from '@core/schema/contentEdit';
import {checkPart} from '@core/schema/fileFormat';
import {
  songIdSchema,
  serviceIdSchema,
  templateIdSchema,
} from '@core/schema/ids';
import type {PayloadError} from '@core/schema/payload';
import type {Logger} from '../log';
import type {ContentEvents, ContentStore} from './contentStore';

const HANDLED = [
  contentEndpoints.edit.channel,
  contentEndpoints.songs.list.channel,
  contentEndpoints.services.list.channel,
  contentEndpoints.templates.list.channel,
  contentEndpoints.songs.get.channel,
  contentEndpoints.services.get.channel,
  contentEndpoints.templates.get.channel,
] as const;

const NO_DATA: EditResult = {
  ok: false,
  error: {reason: 'not-found', message: 'The data folder could not be read'},
};

/**
 * Answers the content channels: `content:edit` and the song, 예배 순서, and 템플릿
 * reads. A request that arrives before the data is read waits for it. A
 * malformed edit is logged and refused, never applied.
 *
 * @returns A function that removes every handler.
 */
export function registerContentChannels(
  content: Promise<ContentStore | null>,
  log: Logger,
): () => void {
  ipcMain.handle(
    contentEndpoints.edit.channel,
    async (_event, value: unknown) => {
      const edit = parseContentEdit(value);
      if (!edit.ok) {
        log.warn('dropped a malformed content edit', edit.error);
        return refuseInvalidEdit(edit.error);
      }
      const store = await content;
      return store === null ? NO_DATA : store.apply(edit.value);
    },
  );
  handleRead(contentEndpoints.songs.list.channel, content, store =>
    store.songList(),
  );
  handleRead(contentEndpoints.services.list.channel, content, store =>
    store.serviceList(),
  );
  handleRead(contentEndpoints.templates.list.channel, content, store =>
    store.templateList(),
  );
  handleDocument(contentEndpoints.songs.get.channel, content, {
    parseId: value => checkPart(songIdSchema, value),
    read: (store, id) => store.song(id),
    log,
  });
  handleDocument(contentEndpoints.services.get.channel, content, {
    parseId: value => checkPart(serviceIdSchema, value),
    read: (store, id) => store.service(id),
    log,
  });
  handleDocument(contentEndpoints.templates.get.channel, content, {
    parseId: value => checkPart(templateIdSchema, value),
    read: (store, id) => store.template(id),
    log,
  });
  return () => {
    for (const channel of HANDLED) {
      ipcMain.removeHandler(channel);
    }
  };
}

/**
 * Sends every content change to every window, and refreshes the open 예배
 * 순서 after song and service document changes.
 */
export function broadcastEvents(
  log: Logger,
  onChange: () => void,
): ContentEvents {
  const send = (channel: string) => (value: unknown) =>
    broadcast(channel, value, log);
  const refresh = (channel: string) => (value: unknown) => {
    broadcast(channel, value, log);
    onChange();
  };
  return {
    songChanged: refresh(contentEndpoints.songs.changed.channel),
    songsListChanged: send(contentEndpoints.songs.listChanged.channel),
    serviceChanged: refresh(contentEndpoints.services.changed.channel),
    servicesListChanged: send(contentEndpoints.services.listChanged.channel),
    templateChanged: send(contentEndpoints.templates.changed.channel),
    templatesListChanged: send(contentEndpoints.templates.listChanged.channel),
  };
}

/** Sends a value to every window that is still open. Never throws. */
export function broadcast(channel: string, value: unknown, log: Logger): void {
  for (const window of BrowserWindow.getAllWindows()) {
    try {
      if (window.isDestroyed() || window.webContents.isDestroyed()) {
        continue;
      }
      window.webContents.send(channel, value);
    } catch (error: unknown) {
      log.warn('could not send a change to a window', {channel, error});
    }
  }
}

function handleRead(
  channel: string,
  content: Promise<ContentStore | null>,
  read: (store: ContentStore) => readonly unknown[],
): void {
  ipcMain.handle(channel, async () => {
    const store = await content;
    return store === null ? [] : read(store);
  });
}

function handleDocument(
  channel: string,
  content: Promise<ContentStore | null>,
  {
    parseId,
    read,
    log,
  }: {
    readonly parseId: (value: unknown) => Result<string, PayloadError>;
    readonly read: (store: ContentStore, id: string) => unknown;
    readonly log: Logger;
  },
): void {
  ipcMain.handle(channel, async (_event, id: unknown) => {
    const checked = parseId(id);
    if (!checked.ok) {
      log.warn('dropped a malformed document id', {channel, ...checked.error});
      return null;
    }
    const store = await content;
    return store === null ? null : read(store, checked.value);
  });
}
