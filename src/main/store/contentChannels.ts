import {BrowserWindow, ipcMain} from 'electron';
import {Channels} from '@contracts/ipc/api';
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
  Channels.contentEdit,
  Channels.songsList,
  Channels.servicesList,
  Channels.templatesList,
  Channels.songsDocumentGet,
  Channels.servicesDocumentGet,
  Channels.templatesDocumentGet,
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
  ipcMain.handle(Channels.contentEdit, async (_event, value: unknown) => {
    const edit = parseContentEdit(value);
    if (!edit.ok) {
      log.warn('dropped a malformed content edit', edit.error);
      return refuseInvalidEdit(edit.error);
    }
    const store = await content;
    return store === null ? NO_DATA : store.apply(edit.value);
  });
  handleRead(Channels.songsList, content, store => store.songList());
  handleRead(Channels.servicesList, content, store => store.serviceList());
  handleRead(Channels.templatesList, content, store => store.templateList());
  handleDocument(Channels.songsDocumentGet, content, {
    parseId: value => checkPart(songIdSchema, value),
    read: (store, id) => store.song(id),
    log,
  });
  handleDocument(Channels.servicesDocumentGet, content, {
    parseId: value => checkPart(serviceIdSchema, value),
    read: (store, id) => store.service(id),
    log,
  });
  handleDocument(Channels.templatesDocumentGet, content, {
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
    songChanged: refresh(Channels.songsDocumentChanged),
    songsListChanged: send(Channels.songsListChanged),
    serviceChanged: refresh(Channels.servicesDocumentChanged),
    servicesListChanged: send(Channels.servicesListChanged),
    templateChanged: send(Channels.templatesDocumentChanged),
    templatesListChanged: send(Channels.templatesListChanged),
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
