import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {parseServiceDocument} from '@shared/schema/contentDocuments';
import {isItemOfKind, parseService} from '@shared/schema/service';
import {parseAppFlushRequest} from '@shared/schema/appFlush';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {registerControlClose} from '../windows/controlClose';
import * as atomicWrite from './atomicWrite';
import {openAppConfig} from './appConfigFile';
import {DATA_FOLDER_NAME} from './locations';
import {registerStore} from './register';
import {itemId, service, writeJson} from './testFiles';

type Handler = (event: unknown, value?: unknown) => unknown;
const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
}));
const ipc = new EventEmitter();

vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => []},
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => electron.handlers.delete(channel),
    on: (channel: string, listener: Handler) => ipc.on(channel, listener),
    removeListener: (channel: string, listener: Handler) =>
      ipc.removeListener(channel, listener),
  },
}));

async function ask(channel: string, value?: unknown): Promise<unknown> {
  const handler = electron.handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler: ${channel}`);
  return handler({}, value);
}

async function readMemo(file: string) {
  const parsed = parseService(await readFile(file, 'utf8'), file);
  if (!parsed.ok) throw new Error('Invalid service file');
  const item = parsed.value.data.order[0];
  return item !== undefined && isItemOfKind(item, 'media')
    ? item.memo
    : undefined;
}

async function currentService(serviceId: string) {
  const parsed = parseServiceDocument(
    await ask(Channels.servicesDocumentGet, serviceId),
  );
  if (!parsed.ok || parsed.value === null) throw new Error('Missing service');
  return parsed.value;
}

it('keeps a close-flush memo in memory after EPERM and saves it before retry closes', async () => {
  const folder = await makeTempDir();
  const serviceId = itemId(1);
  const target = {serviceId, itemId: itemId(2)};
  const file = join(folder, DATA_FOLDER_NAME, '예배', `${serviceId}.llservice`);
  const oldMemo = 'Earlier persisted memo';
  const newestMemo = 'Newest close flush memo';
  await writeJson(
    file,
    service(serviceId, '2026-10-26T10:00', [
      {id: target.itemId, media: itemId(3), memo: oldMemo},
    ]),
  );
  const log = recordingLogger();
  const appConfig = await openAppConfig({file: join(folder, 'app.json'), log});
  const store = registerStore({
    log,
    appConfig,
    context: () => ({documents: folder, developmentFolder: folder}),
    isAnyOutputOn: () => true,
    problems: {
      report: vi.fn(),
      push: vi.fn(),
      addStanding: () => () => undefined,
    },
  });
  onTestFinished(async () => {
    await store.dispose();
    appConfig.dispose();
  });
  let locked = true;
  const original = atomicWrite.writeFileAtomically;
  const write = vi
    .spyOn(atomicWrite, 'writeFileAtomically')
    .mockImplementation((path, text) =>
      path === file && locked
        ? Promise.resolve({ok: false, error: {file, message: 'EPERM: rename'}})
        : original(path, text),
    );
  const control = new EventEmitter();
  const contents = new EventEmitter();
  const sender = {id: 7};
  let destroyed = false;
  let requestFlush: (value: unknown) => void = () => undefined;
  const close = (): void => {
    const event = {
      prevented: false,
      preventDefault() {
        event.prevented = true;
      },
    };
    control.emit('close', event);
    if (!event.prevented) destroyed = true;
  };
  const closing = registerControlClose({
    log,
    control: {
      on: control.on.bind(control),
      removeListener: control.removeListener.bind(control),
      close,
      isDestroyed: () => destroyed,
      webContents: {
        ...sender,
        isDestroyed: () => destroyed,
        on: contents.on.bind(contents),
        removeListener: contents.removeListener.bind(contents),
        send: (channel, value) => {
          if (channel === Channels.appFlushRequest) requestFlush(value);
        },
      },
    },
  });
  onTestFinished(() => closing.dispose());
  const replies: boolean[] = [];
  const answerFlush = async (value: unknown): Promise<void> => {
    const parsed = parseAppFlushRequest(value);
    if (!parsed.ok) throw new Error('Invalid flush request');
    const document = await currentService(serviceId);
    await ask(Channels.contentEdit, {
      type: 'service.update',
      baseRevision: document.revision,
      service: {
        ...document.service,
        order: document.service.order.map(item =>
          item.id === target.itemId ? {...item, memo: newestMemo} : item,
        ),
      },
    });
    const result = (await ask(Channels.appSavePending)) === true;
    replies.push(result);
    ipc.emit(Channels.appFlushDone, {sender}, {...parsed.value, result});
  };
  requestFlush = value => {
    answerFlush(value).catch((error: unknown) => {
      log.error('could not answer the test flush request', error);
    });
  };
  close();
  await vi.waitFor(() => expect(replies).toEqual([false]));
  expect(destroyed).toBe(false);
  expect((await currentService(serviceId)).service.order).toContainEqual(
    expect.objectContaining({id: target.itemId, memo: newestMemo}),
  );
  expect(await readMemo(file)).toBe(oldMemo);
  expect(write.mock.calls.some(([path]) => path === file)).toBe(true);
  locked = false;
  close();
  await vi.waitFor(() => expect(destroyed).toBe(true));
  expect(replies).toEqual([false, true]);
  expect(await readMemo(file)).toBe(newestMemo);
});
