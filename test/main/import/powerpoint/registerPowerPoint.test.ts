import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {expect, it, onTestFinished, vi} from 'vitest';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerPowerPointImport} from '@main/import/powerpoint/registerPowerPoint';
import type {PowerPointImagesJob} from '@main/import/powerpoint/powerpointImages';
import type {PictureStore} from '@main/import/slidePictures/storePictures';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({
  app: {getPath: () => ''},
  BrowserWindow: class {
    isDestroyed() {
      return false;
    }
  },
  dialog: {showOpenDialog: vi.fn()},
  ipcMain: ipc.ipcMain,
}));

function setUp() {
  const media = {
    get: vi.fn<PictureStore['get']>(),
    fileOf: vi.fn<PictureStore['fileOf']>(),
    folder: join('C:', 'media'),
    add: vi.fn<PictureStore['add']>(),
  } satisfies PictureStore;
  const stop = registerPowerPointImport(
    {
      control: new BrowserWindow({show: false}),
      windowMode: 'normal',
      log: recordingLogger(),
      media: Promise.resolve(media),
    },
    {run: vi.fn(async () => null), cancel: vi.fn(), dispose: vi.fn()},
    {run: vi.fn<PowerPointImagesJob['run']>(), cancel: vi.fn()},
  );
  onTestFinished(() => {
    stop();
    ipc.reset();
  });
  return {media, stop};
}

const STRANGER = join('C:', 'Users', 'someone', 'secret.png');

it('stores no picture it did not make, nor one asked for twice', async () => {
  const {media} = setUp();
  const refused = {ok: false, message: 'PowerPoint 이미지 가져오기 실패'};
  await expect(
    ipc.invoke(powerpointEndpoints.storeImages, {paths: [STRANGER]}),
  ).resolves.toEqual(refused);
  await expect(
    ipc.invoke(powerpointEndpoints.storeImages, {
      paths: [STRANGER, STRANGER],
    }),
  ).resolves.toEqual(refused);
  expect(media.add).not.toHaveBeenCalled();
  expect(media.fileOf).not.toHaveBeenCalled();
});

it('shows and removes no picture it did not make', async () => {
  setUp();
  await expect(
    ipc.invoke(powerpointEndpoints.previewImage, {path: STRANGER}),
  ).resolves.toBeNull();
  await expect(
    ipc.invoke(powerpointEndpoints.release, {path: STRANGER}),
  ).resolves.toBe(false);
});
