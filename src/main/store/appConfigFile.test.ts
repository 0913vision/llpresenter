import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {writeFileAtomically} from './atomicWrite';
import {serviceIdSchema} from '@shared/schema/ids';
import {testId} from '@shared/schema/testHelpers';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {UiStateStore} from '../uiState/uiStateStore';
import {openAppConfig} from './appConfigFile';
import type {WriteResult} from './fileWriter';
import {SUNDAY_ID, writeJson} from './testFiles';

const SUNDAY = testId(serviceIdSchema, SUNDAY_ID);

const BROKEN =
  'app.json is broken, so the app keeps it as it is and never writes over it';
const NEWER =
  'app.json comes from a newer app version, so the app never writes over it';

function fakeLog() {
  return {
    info: vi.fn<Logger['info']>(),
    warn: vi.fn<Logger['warn']>(),
    error: vi.fn<Logger['error']>(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

async function appJson(): Promise<string> {
  return join(await makeTempDir(), 'app.json');
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

describe('openAppConfig with a broken app.json (qa C19)', () => {
  it('retains failed app.json writes and saves the newest configuration on retry', async () => {
    const file = await appJson();
    await writeJson(file, {
      format: 'llapp',
      schemaVersion: 1,
      uiZoomPercent: 100,
    });
    let locked = true;
    const appConfig = await openAppConfig({
      file,
      log: fakeLog(),
      writeText: (path, text) =>
        locked
          ? Promise.resolve({
              ok: false,
              error: {file, message: 'EPERM: rename'},
            })
          : writeFileAtomically(path, text),
    });
    onTestFinished(() => appConfig.dispose());
    appConfig.setUiZoomPercent(110);
    expect(await appConfig.savePending()).toBe(false);
    expect(appConfig.uiZoomPercent).toBe(110);
    expect(await readJson(file)).toMatchObject({uiZoomPercent: 100});
    expect(await appConfig.savePending()).toBe(false);
    appConfig.setUiZoomPercent(120);
    expect(await appConfig.savePending()).toBe(false);
    locked = false;
    expect(await appConfig.savePending()).toBe(true);
    expect(await readJson(file)).toMatchObject({uiZoomPercent: 120});
  });
  it.each([
    ['(a) text that is not JSON', 'not json', ''],
    ['(b) an empty file', '', ''],
    ['(c) a JSON array', '[]', ''],
    [
      '(d) a wrong format',
      JSON.stringify({format: 'llsong', schemaVersion: 1}),
      'format',
    ],
    [
      '(e) a left width that is text',
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        layout: {normal: {left: 'wide'}},
      }),
      'layout.normal.left',
    ],
  ])(
    'logs one warning with the file and the field for %s, and keeps it',
    async (_name, text, field) => {
      const file = await appJson();
      await writeFile(file, text);
      const log = fakeLog();

      const appConfig = await openAppConfig({file, log});
      appConfig.change({mediaStrip: true});
      await appConfig.flush();

      expect(log.warn.mock.calls).toEqual([
        [BROKEN, expect.objectContaining({file, field})],
      ]);
      expect(log.error).not.toHaveBeenCalled();
      expect(appConfig.isBroken).toBe(true);
      expect(appConfig.read()).toEqual({mediaStrip: true});
      expect(await readFile(file, 'utf8')).toBe(text);
    },
  );

  it('still uses the location fields of a broken file', async () => {
    const file = await appJson();
    const songs = join(file, '..', '곡');
    await writeJson(file, {
      format: 'llapp',
      schemaVersion: 1,
      songsPath: songs,
      layout: {normal: {left: 'wide'}},
    });

    const appConfig = await openAppConfig({file, log: fakeLog()});

    expect(appConfig.locationFields).toEqual({songsPath: songs});
    expect(appConfig.read()).toEqual({});
  });

  it('logs one warning for a file it cannot read, and never writes it', async () => {
    const file = await appJson();
    await mkdir(file);
    const log = fakeLog();

    const appConfig = await openAppConfig({file, log});
    appConfig.change({mediaStrip: true});
    await appConfig.flush();

    expect(log.warn.mock.calls).toEqual([
      [BROKEN, expect.objectContaining({file, kind: 'read'})],
    ]);
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe('openAppConfig', () => {
  it('keeps panel visibility, layout, service, zoom, and unknown fields through the single writer', async () => {
    const file = await appJson();
    const config = {
      format: 'llapp',
      schemaVersion: 1,
      future: {keep: true},
      layout: {normal: {left: 280, right: 480, extra: true}},
    };
    await writeJson(file, config);
    const log = fakeLog();
    const appConfig = await openAppConfig({file, log});
    const ui = new UiStateStore({fields: appConfig, log});
    ui.setMediaStrip({visible: false});
    ui.setLayout({sizeClass: 'normal', leftCollapsed: true});
    appConfig.setLastServiceId(SUNDAY);
    appConfig.setUiZoomPercent(120);
    await appConfig.flush();
    expect(await readJson(file)).toEqual({
      ...config,
      mediaStrip: false,
      lastServiceId: SUNDAY_ID,
      uiZoomPercent: 120,
      layout: {normal: {...config.layout.normal, leftCollapsed: true}},
    });
    const reopened = await openAppConfig({file, log});
    expect(new UiStateStore({fields: reopened, log}).state).toEqual(ui.state);
    reopened.dispose();
    appConfig.dispose();
  });
  it('reads the default zoom without a stored value and saves zoom with UI and service edits', async () => {
    const file = await appJson();
    const config = {
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 280}},
      future: {keep: true},
    };
    await writeJson(file, config);
    const appConfig = await openAppConfig({file, log: fakeLog()});
    expect(appConfig.uiZoomPercent).toBe(100);

    appConfig.setUiZoomPercent(120);
    appConfig.change({mediaStrip: true});
    appConfig.setLastServiceId(SUNDAY);
    await appConfig.flush();

    expect(await readJson(file)).toEqual({
      ...config,
      uiZoomPercent: 120,
      mediaStrip: true,
      lastServiceId: SUNDAY_ID,
    });
    expect((await openAppConfig({file, log: fakeLog()})).uiZoomPercent).toBe(
      120,
    );
  });

  it('defaults an invalid zoom without losing the other app fields', async () => {
    const file = await appJson();
    await writeJson(file, {
      format: 'llapp',
      schemaVersion: 1,
      uiZoomPercent: 155,
      mediaStrip: true,
    });
    const appConfig = await openAppConfig({file, log: fakeLog()});
    expect(appConfig.uiZoomPercent).toBe(100);
    expect(appConfig.isBroken).toBe(false);
    expect(appConfig.read()).toEqual({mediaStrip: true});
  });

  it('keeps a broken file untouched while allowing zoom recovery in memory', async () => {
    const file = await appJson();
    await writeFile(file, 'broken');
    const appConfig = await openAppConfig({file, log: fakeLog()});
    expect(appConfig.uiZoomPercent).toBe(100);
    appConfig.setUiZoomPercent(110);
    await appConfig.flush();
    expect(appConfig.uiZoomPercent).toBe(110);
    expect(await readFile(file, 'utf8')).toBe('broken');
  });

  it('shows a file from a newer version and never writes it (qa C19 g)', async () => {
    const file = await appJson();
    const newer = {
      format: 'llapp',
      schemaVersion: 99,
      layout: {normal: {left: 280}},
    };
    await writeJson(file, newer);
    const log = fakeLog();

    const appConfig = await openAppConfig({file, log});
    appConfig.change({layout: {normal: {left: 300}}});
    await appConfig.flush();

    expect(log.warn.mock.calls).toEqual([[NEWER, {file}]]);
    expect(appConfig.read()).toEqual({layout: {normal: {left: 300}}});
    expect(await readJson(file)).toEqual(newer);
  });

  it('starts empty without a file, and the first change creates it (qa C20)', async () => {
    const file = join(await makeTempDir(), 'not-yet', 'app.json');
    const log = fakeLog();

    const appConfig = await openAppConfig({file, log});
    expect(appConfig.read()).toEqual({});
    appConfig.change({layout: {normal: {left: 280}}});
    await appConfig.flush();

    expect(log.warn).not.toHaveBeenCalled();
    expect(await readJson(file)).toEqual({
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 280}},
    });
  });

  it('keeps a UI change and a last service change made in a row, and unknown fields', async () => {
    const file = await appJson();
    await writeJson(file, {
      format: 'llapp',
      schemaVersion: 1,
      dataRoot: '',
      theme: 'dark',
      layout: {normal: {left: 280, extra: 1}},
    });

    const appConfig = await openAppConfig({file, log: fakeLog()});
    appConfig.change({mediaStrip: true});
    appConfig.setLastServiceId(SUNDAY);
    await appConfig.flush();

    expect(await readJson(file)).toEqual({
      format: 'llapp',
      schemaVersion: 1,
      dataRoot: '',
      theme: 'dark',
      layout: {normal: {left: 280, extra: 1}},
      mediaStrip: true,
      lastServiceId: SUNDAY_ID,
    });
    expect(appConfig.lastServiceId).toBe(SUNDAY_ID);
  });

  it('saves a burst of changes once, with the last value', async () => {
    const file = await appJson();
    const writeText = vi.fn(
      async (target: string, text: string): Promise<WriteResult> => {
        await writeFile(target, text);
        return {ok: true, value: undefined};
      },
    );

    const appConfig = await openAppConfig({file, log: fakeLog(), writeText});
    for (const left of [200, 240, 280]) {
      appConfig.change({layout: {normal: {left}}});
    }
    await appConfig.flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await readJson(file)).toMatchObject({layout: {normal: {left: 280}}});
  });
});
