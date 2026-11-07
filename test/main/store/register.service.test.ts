import {
  ask,
  askForService,
  developmentContext,
  electron,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {liveEndpoints} from '@contracts/ipc/live';
import {serviceEndpoints} from '@contracts/ipc/service';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import * as atomicWrite from '@main/store/atomicWrite';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {itemId, writeJson} from '@fixtures/main/store/testFiles';

describe('registerStore', () => {
  it('saves and switches services, remembers the choice across restart, and sends no live-output change', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const ids = [itemId(1), itemId(2)];
    const firstId = itemId(1);
    const secondId = itemId(2);
    const appFile = join(context.appDataFolder, 'app.json');
    await writeJson(appFile, {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: firstId,
      uiZoomPercent: 120,
      future: 'kept',
    });
    for (const [index, id] of ids.entries()) {
      await writeJson(join(root, 'Services', `${id}.llservice`), {
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: `Invented service ${index}`,
        date: '2026-10-26T10:00',
        order: [],
      });
    }
    const first = await register(mockLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: firstId});
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: itemId(9)}),
    ).toBeNull();
    expect(await askForService()).toMatchObject({id: firstId});
    const current = await ask(contentEndpoints.services.get.channel, firstId);
    const parsed = parseServiceDocument(current);
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(contentEndpoints.edit.channel, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Edited current service'},
      baseRevision: 1,
    });
    electron.send.mockClear();
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: secondId}),
    ).toMatchObject({id: secondId});
    expect(await askForService()).toMatchObject({id: secondId});
    expect(
      JSON.parse(
        await readFile(join(root, 'Services', `${firstId}.llservice`), 'utf8'),
      ),
    ).toMatchObject({name: 'Edited current service'});
    expect(JSON.parse(await readFile(appFile, 'utf8'))).toMatchObject({
      lastServiceId: secondId,
      uiZoomPercent: 120,
      future: 'kept',
    });
    expect(electron.send).toHaveBeenCalledWith(
      serviceEndpoints.changed.channel,
      expect.objectContaining({id: secondId}),
    );
    expect(electron.send).not.toHaveBeenCalledWith(
      liveEndpoints.changed.channel,
      expect.anything(),
    );
    await first.dispose();
    await register(mockLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: secondId});
  });

  it('keeps the current service and saved launch choice when saving its pending edit fails', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const firstId = itemId(1);
    const secondId = itemId(2);
    const appFile = join(context.appDataFolder, 'app.json');
    const firstFile = join(root, 'Services', `${firstId}.llservice`);
    await writeJson(appFile, {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: firstId,
    });
    for (const [index, id] of [firstId, secondId].entries()) {
      await writeJson(join(root, 'Services', `${id}.llservice`), {
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: `Invented service ${index}`,
        date: '2026-10-26T10:00',
        order: [],
      });
    }
    const original = atomicWrite.writeFileAtomically;
    const write = vi
      .spyOn(atomicWrite, 'writeFileAtomically')
      .mockImplementation((file, text) =>
        file === firstFile
          ? Promise.resolve({
              ok: false,
              error: {file, message: 'Disk unavailable'},
            })
          : original(file, text),
      );
    await register(mockLog(), context, () => true);
    await askForService();
    const parsed = parseServiceDocument(
      await ask(contentEndpoints.services.get.channel, firstId),
    );
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(contentEndpoints.edit.channel, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Unsaved current service'},
      baseRevision: 1,
    });
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: secondId}),
    ).toBeNull();
    expect(
      write.mock.calls.filter(([file]) => file === firstFile),
    ).toHaveLength(1);
    expect(await askForService()).toMatchObject({
      id: firstId,
      name: 'Unsaved current service',
    });
    expect(JSON.parse(await readFile(firstFile, 'utf8'))).toMatchObject({
      name: 'Invented service 0',
    });
    expect(JSON.parse(await readFile(appFile, 'utf8'))).toMatchObject({
      lastServiceId: firstId,
    });
  });

  it('answers null when there is no 예배 순서', async () => {
    const context = await developmentContext();
    const log = mockLog();
    await register(log, context);

    expect(await askForService()).toBeNull();
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
      show: {atLastSlide: 'stop'},
    });
    expect(log.info).toHaveBeenCalledWith(
      'read the data folder',
      expect.objectContaining({songs: 0, services: 0, openServiceId: null}),
    );
    expect(log.warn).not.toHaveBeenCalled();
  });
});
