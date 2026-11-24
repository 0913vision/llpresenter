import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {appEndpoints} from '@contracts/ipc/app';
import {contentEndpoints} from '@contracts/ipc/content';
import {parseServiceDocument} from '@core/schema/services/contentDocuments';
import {isItemOfKind, parseService} from '@core/schema/services/service';
import {
  APP_FLUSH_LIMITS,
  parseAppFlushRequest,
} from '@core/schema/app/appFlush';
import {parseAppConfig} from '@core/schema/app/appConfig';
import {installMockClock} from '@fixtures/mockClock';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerControlClose} from '@main/windows/controlClose';
import * as atomicWrite from '@main/base/atomicWrite';
import {openAppConfig} from '@main/store/locations/appConfigFile';
import type {WriteResult} from '@main/store/files/fileWriter';
import {DATA_FOLDER_NAME} from '@main/store/locations/locations';
import {registerStore} from '@main/store/register';
import {ShutdownCoordinator} from '@main/base/shutdown';
import {itemId, service, writeJson} from '@fixtures/main/store/testFiles';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => []},
  ipcMain: ipc.ipcMain,
}));

async function readName(file: string) {
  const parsed = parseService(await readFile(file, 'utf8'), file);
  if (!parsed.ok) throw new Error('Invalid service file');
  const item = parsed.value.data.order[0];
  return item !== undefined && isItemOfKind(item, 'media')
    ? item.name
    : undefined;
}

async function currentService(serviceId: string) {
  const parsed = parseServiceDocument(
    await ipc.invoke(contentEndpoints.services.get, serviceId),
  );
  if (!parsed.ok || parsed.value === null) throw new Error('Missing service');
  return parsed.value;
}

it.each([
  {blocked: 'service', slow: false},
  {blocked: 'service', slow: true},
  {blocked: 'config', slow: false},
])(
  'keeps close open after $blocked EPERM and saves before retry closes (slow: $slow)',
  async ({blocked, slow}) => {
    const folder = await makeTempDir();
    const serviceId = itemId(1);
    const target = {serviceId, itemId: itemId(2)};
    const file = join(
      folder,
      DATA_FOLDER_NAME,
      'Services',
      `${serviceId}.llservice`,
    );
    const oldName = 'Earlier persisted name';
    const newestName = 'Newest close flush name';
    await writeJson(
      file,
      service(serviceId, '2026-10-26T10:00', [
        {
          id: target.itemId,
          kind: 'media',
          name: oldName,
          media: itemId(3),
          slides: [],
        },
      ]),
    );
    const log = recordingLogger();
    const configFile = join(folder, 'app.json');
    await writeJson(configFile, {
      format: 'llapp',
      schemaVersion: 1,
      uiZoomPercent: 100,
    });
    const appConfig = await openAppConfig({
      file: configFile,
      log,
      writeText: (path, text) => atomicWrite.writeFileAtomically(path, text),
    });
    if (blocked === 'config') appConfig.setUiZoomPercent(110);
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
      locked = false;
      finish({ok: false, error: {file, message: 'EPERM: rename'}});
      await store.dispose();
      appConfig.dispose();
    });
    let locked = true;
    let attempts = 0;
    let finish: (result: WriteResult) => void = () => undefined;
    const delayed = new Promise<WriteResult>(resolve => {
      finish = resolve;
    });
    const blockedFile = blocked === 'config' ? configFile : file;
    const original = atomicWrite.writeFileAtomically;
    const write = vi
      .spyOn(atomicWrite, 'writeFileAtomically')
      .mockImplementation((path, text) => {
        if (path !== blockedFile || !locked) return original(path, text);
        attempts++;
        if (slow && attempts > 1) return delayed;
        return Promise.resolve({
          ok: false,
          error: {file: path, message: 'EPERM: rename'},
        });
      });
    const control = new EventEmitter();
    const contents = new EventEmitter();
    const sender = {id: 7};
    let destroyed = false;
    let finishClose: () => void = () => undefined;
    const closed = new Promise<void>(resolve => {
      finishClose = resolve;
    });
    let requestFlush: (value: unknown) => void = () => undefined;
    const close = (): void => {
      const event = {
        prevented: false,
        preventDefault() {
          event.prevented = true;
        },
      };
      control.emit('close', event);
      if (!event.prevented) {
        destroyed = true;
        finishClose();
      }
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
            if (channel === appEndpoints.flushRequests.channel) {
              requestFlush(value);
            }
          },
        },
      },
    });
    onTestFinished(() => closing.dispose());
    const replies: boolean[] = [];
    const answerFlush = async (value: unknown): Promise<void> => {
      const parsed = parseAppFlushRequest(value);
      if (!parsed.ok) throw new Error('Invalid flush request');
      const progress = (): void => {
        ipc.send(appEndpoints.flushProgress, parsed.value, sender);
      };
      progress();
      const interval = setInterval(
        progress,
        APP_FLUSH_LIMITS.progressIntervalMs,
      );
      try {
        const document = await currentService(serviceId);
        await ipc.invoke(contentEndpoints.edit, {
          type: 'service.update',
          baseRevision: document.revision,
          service: {
            ...document.service,
            order: document.service.order.map(item =>
              item.id === target.itemId ? {...item, name: newestName} : item,
            ),
          },
        });
        const result = (await ipc.invoke(appEndpoints.savePending)) === true;
        replies.push(result);
        ipc.send(appEndpoints.flushDone, {...parsed.value, result}, sender);
      } finally {
        clearInterval(interval);
      }
    };
    requestFlush = value => {
      answerFlush(value).catch((error: unknown) => {
        log.error('could not answer the test flush request', error);
      });
    };
    await currentService(serviceId);
    const clock = slow ? installMockClock() : undefined;
    close();
    if (clock !== undefined) {
      await vi.waitFor(() => expect(attempts).toBeGreaterThan(1));
      await clock.advance(APP_FLUSH_LIMITS.timeoutMs * 2);
      expect(destroyed).toBe(false);
      expect(replies).toEqual([]);
      finish({ok: false, error: {file, message: 'EPERM: rename'}});
    }
    await vi.waitFor(() => expect(replies).toEqual([false]));
    expect(destroyed).toBe(false);
    expect((await currentService(serviceId)).service.order).toContainEqual(
      expect.objectContaining({id: target.itemId, name: newestName}),
    );
    expect(await readName(file)).toBe(
      blocked === 'service' ? oldName : newestName,
    );
    expect(write.mock.calls.some(([path]) => path === blockedFile)).toBe(true);
    const app = {
      on: vi.fn(),
      quit: vi.fn(),
      releaseSingleInstanceLock: vi.fn(),
    };
    const coordinator = new ShutdownCoordinator({app, log});
    const install = vi.fn();
    const dispose = vi.fn();
    coordinator.confirmWith(() => Promise.resolve(true));
    coordinator.add({name: 'dispose stores', run: dispose});
    expect(
      await coordinator.quitForUpdate(install, () => true, {
        savePending: store.savePending,
      }),
    ).toBe(false);
    expect(install).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
    expect(app.releaseSingleInstanceLock).not.toHaveBeenCalled();
    const configBefore = parseAppConfig(
      await readFile(configFile, 'utf8'),
      configFile,
    );
    expect(configBefore).toMatchObject({
      ok: true,
      value: {data: {uiZoomPercent: 100}},
    });
    locked = false;
    close();
    await closed;
    expect(destroyed).toBe(true);
    expect(replies).toEqual([false, true]);
    expect(await readName(file)).toBe(newestName);
    const configAfter = parseAppConfig(
      await readFile(configFile, 'utf8'),
      configFile,
    );
    expect(configAfter).toMatchObject({
      ok: true,
      value: {data: {uiZoomPercent: blocked === 'config' ? 110 : 100}},
    });
  },
);
