import {app, ipcMain, type IpcMainEvent} from 'electron';
import {join} from 'node:path';
import {pictureEndpoints} from '@contracts/ipc/picture';
import {parsePictureRequest, parsePictureUpload} from '@core/schema/picture';
import {PictureCache} from './pictureCache';

const MAX_PENDING = 128;

/** Registers a bounded, serialized painter shared by renderer windows. */
export function registerPictureChannels(): () => Promise<void> {
  const cache = new PictureCache(
    join(app.getPath('userData'), 'cache', 'pictures'),
  );
  let pending = 0;
  ipcMain.handle(
    pictureEndpoints.paint.channel,
    async (event, value: unknown) => {
      const parsed = parsePictureRequest(value);
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !parsed.ok ||
        pending >= MAX_PENDING
      ) {
        throw new Error('Invalid or excessive picture request');
      }
      pending++;
      try {
        return new Uint8Array(await cache.get(parsed.value));
      } finally {
        pending--;
      }
    },
  );
  ipcMain.handle(
    pictureEndpoints.peek.channel,
    async (event, value: unknown) => {
      const parsed = parsePictureRequest(value);
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !parsed.ok ||
        pending >= MAX_PENDING
      ) {
        throw new Error('Invalid or excessive picture request');
      }
      pending++;
      try {
        const image = await cache.peek(parsed.value);
        return image === null ? null : new Uint8Array(image);
      } finally {
        pending--;
      }
    },
  );
  const remember = (event: IpcMainEvent, value: unknown): void => {
    if (event.senderFrame !== event.sender.mainFrame) return;
    const parsed = parsePictureUpload(value);
    if (parsed.ok) {
      cache.remember(
        parsed.value.picture,
        Buffer.from(parsed.value.image),
        event.sender.id,
      );
    }
  };
  ipcMain.on(pictureEndpoints.remember.channel, remember);
  const reserve = (event: IpcMainEvent, value: unknown): void => {
    let reserved = false;
    try {
      const parsed = parsePictureRequest(value);
      reserved =
        event.senderFrame === event.sender.mainFrame &&
        parsed.ok &&
        cache.reserve(parsed.value, event.sender.id);
    } catch {
      reserved = false;
    } finally {
      event.returnValue = reserved;
    }
  };
  const release = (event: IpcMainEvent, value: unknown): void => {
    if (event.senderFrame !== event.sender.mainFrame) return;
    const parsed = parsePictureRequest(value);
    if (parsed.ok) cache.release(parsed.value, event.sender.id);
  };
  ipcMain.on(pictureEndpoints.reserve, reserve);
  ipcMain.on(pictureEndpoints.release.channel, release);
  return () => {
    ipcMain.removeHandler(pictureEndpoints.paint.channel);
    ipcMain.removeHandler(pictureEndpoints.peek.channel);
    ipcMain.removeListener(pictureEndpoints.remember.channel, remember);
    ipcMain.removeListener(pictureEndpoints.reserve, reserve);
    ipcMain.removeListener(pictureEndpoints.release.channel, release);
    return cache.dispose();
  };
}
