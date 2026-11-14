import {readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {registerPowerPointImport} from '@main/import/registerPowerPoint';
import type {PowerPointJob} from '@main/import/powerpointJob';
import {makeTempDir} from '@fixtures/tempDir';
import {
  registerTextImport,
  TEST_IMPORT_FILE_VARIABLE,
} from '@main/import/register';
import {TEXT_IMPORT_LIMITS} from '@core/songs/textImportLimits';
import {convertTextImport} from '@core/songs/textImport';
import {readTextImport} from '@main/import/read';

vi.mock('@main/import/read', async importOriginal => {
  const actual = await importOriginal<typeof import('@main/import/read')>();
  return {...actual, readTextImport: vi.fn(actual.readTextImport)};
});
vi.mock('@core/songs/textImport', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@core/songs/textImport')>();
  return {...actual, convertTextImport: vi.fn(actual.convertTextImport)};
});

type Handler = (event: unknown, value: unknown) => unknown;
interface Selection {
  readonly canceled: boolean;
  readonly filePaths: string[];
}

const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  chooseFile: vi.fn<() => Promise<Selection>>(),
  readClipboard: vi.fn<() => Promise<string>>(),
  destroyed: false,
  tempDir: '',
}));

vi.mock('electron', () => ({
  app: {getPath: () => electron.tempDir},
  BrowserWindow: class {
    isDestroyed() {
      return electron.destroyed;
    }
  },
  clipboard: {readText: electron.readClipboard},
  dialog: {showOpenDialog: electron.chooseFile},
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
}));

beforeEach(() => {
  electron.handlers.clear();
  electron.chooseFile
    .mockReset()
    .mockResolvedValue({canceled: true, filePaths: []});
  electron.readClipboard.mockReset().mockResolvedValue('Clipboard lyrics');
  electron.destroyed = false;
});

function handler(channel: string): Handler {
  const found = electron.handlers.get(channel);
  if (found === undefined) throw new Error(`No handler for ${channel}`);
  return found;
}

function setup(windowMode: 'normal' | 'offscreen' = 'normal') {
  const control = new BrowserWindow({show: false});
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
  const stop = registerTextImport({control, windowMode, log});
  onTestFinished(stop);
  return {control, log, stop};
}

const readRequest = {source: 'file', encoding: 'auto'};

describe('PowerPoint import', () => {
  it('validates scene bytes and writes the composed image into the managed media path', async () => {
    const {control, log} = setup();
    electron.tempDir = await makeTempDir();
    const scene = {key: 'a'.repeat(64), layers: [], pictures: [], skipped: 0};
    const run = vi.fn(async (job: PowerPointJob): Promise<unknown> => {
      if (job.kind === 'read') {
        return {
          digest: 'a'.repeat(64),
          widescreen: true,
          slides: [{number: 4, shapes: [], background: scene.key}],
        };
      }
      if (job.kind === 'layers') return scene;
      throw new Error('Unexpected worker job');
    });
    onTestFinished(
      registerPowerPointImport(
        {control, windowMode: 'normal', log},
        {run, dispose: vi.fn()},
      ),
    );
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['example.pptx'],
    });
    await handler(powerpointEndpoints.read.channel)({}, undefined);
    expect(
      await handler(powerpointEndpoints.layers.channel)({}, {index: 0}),
    ).toEqual(scene);
    expect(run).toHaveBeenLastCalledWith({
      kind: 'layers',
      path: 'example.pptx',
      digest: 'a'.repeat(64),
      number: 4,
    });
    run.mockResolvedValueOnce({
      ...scene,
      layers: Array.from({length: 65}, () => ({})),
    });
    expect(
      await handler(powerpointEndpoints.layers.channel)({}, {index: 0}),
    ).toBeNull();
    const image = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);
    image.write('IHDR', 12);
    image.writeUInt32BE(1920, 16);
    image.writeUInt32BE(1080, 20);
    const path = await handler(powerpointEndpoints.background.channel)(
      {},
      {index: 0, image: {mime: 'image/png', bytes: new Uint8Array(image)}},
    );
    expect(typeof path).toBe('string');
    expect(run).toHaveBeenCalledTimes(3);
    expect(await handler(powerpointEndpoints.release.channel)({}, {path})).toBe(
      true,
    );
    expect(await readdir(electron.tempDir)).toEqual([]);
  });
  it('refuses the old PowerPoint format before reading it', async () => {
    const {control, log} = setup();
    onTestFinished(
      registerPowerPointImport({control, windowMode: 'normal', log}),
    );
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['old.ppt'],
    });
    expect(
      await handler(powerpointEndpoints.read.channel)({}, undefined),
    ).toEqual({
      ok: false,
      message:
        'PowerPoint 97-2003 파일은 가져올 수 없습니다. PowerPoint에서 .pptx로 저장한 뒤 가져오십시오.',
    });
  });

  it('releases every temporary image after repeated imports and failures', async () => {
    const {control, log} = setup();
    electron.tempDir = await makeTempDir();
    const jobs = {
      run: vi.fn(async (job: PowerPointJob): Promise<unknown> => {
        if (job.kind === 'match' || job.kind === 'layers') return null;
        if (job.kind === 'read') {
          return {
            digest: 'a'.repeat(64),
            widescreen: true,
            slides: [
              {number: 1, shapes: [], background: 'ppt/media/image.png'},
            ],
          };
        }
        await writeFile(job.target, 'temporary image');
        return true;
      }),
      dispose: vi.fn(),
    };
    onTestFinished(
      registerPowerPointImport({control, windowMode: 'normal', log}, jobs),
    );
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['example.pptx'],
    });
    expect(
      await handler(powerpointEndpoints.read.channel)({}, undefined),
    ).toMatchObject({ok: true});
    for (let i = 0; i < 12; i++) {
      const path = await handler(powerpointEndpoints.background.channel)(
        {},
        {index: 0},
      );
      expect(typeof path).toBe('string');
      const first = await handler(powerpointEndpoints.release.channel)(
        {},
        {path},
      );
      const second = await handler(powerpointEndpoints.release.channel)(
        {},
        {path},
      );
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(await readdir(electron.tempDir)).toEqual([]);
    }
    jobs.run.mockImplementationOnce(async job => {
      if (job.kind === 'background') await writeFile(job.target, 'partial');
      throw new Error('extraction failed');
    });
    expect(
      await handler(powerpointEndpoints.background.channel)({}, {index: 0}),
    ).toBeNull();
    expect(await readdir(electron.tempDir)).toEqual([]);
    const unrelated = join(electron.tempDir, 'unrelated.png');
    await writeFile(unrelated, 'keep');
    expect(
      await handler(powerpointEndpoints.release.channel)({}, {path: unrelated}),
    ).toBe(false);
    expect(await readdir(electron.tempDir)).toEqual(['unrelated.png']);
  });

  it('cleans an extraction that finishes after the importer closes', async () => {
    const {control, log} = setup();
    electron.tempDir = await makeTempDir();
    let finish: () => void = () => undefined;
    let signalStart: () => void = () => undefined;
    const wait = new Promise<void>(resolve => {
      finish = resolve;
    });
    const started = new Promise<void>(resolve => {
      signalStart = resolve;
    });
    const jobs = {
      run: async (job: PowerPointJob): Promise<unknown> => {
        if (job.kind === 'match' || job.kind === 'layers') return null;
        if (job.kind === 'read') {
          return {
            digest: 'a'.repeat(64),
            widescreen: true,
            slides: [{number: 1, shapes: [], background: 'ppt/media/bg.png'}],
          };
        }
        signalStart();
        await wait;
        await writeFile(job.target, 'temporary image');
        return true;
      },
      dispose: vi.fn(),
    };
    const stop = registerPowerPointImport(
      {control, windowMode: 'normal', log},
      jobs,
    );
    onTestFinished(stop);
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['example.pptx'],
    });
    await handler(powerpointEndpoints.read.channel)({}, undefined);
    const pending = handler(powerpointEndpoints.background.channel)(
      {},
      {index: 0},
    );
    await started;
    stop();
    finish();
    expect(await pending).toBeNull();
    expect(await readdir(electron.tempDir)).toEqual([]);
  });
});

describe('clipboard availability', () => {
  it.each([
    {text: 'Invented text', available: true},
    {text: '', available: false},
    {text: ' \n\t', available: false},
    {text: 'a'.repeat(TEXT_IMPORT_LIMITS.characters + 1), available: false},
  ])(
    'checks usable text without returning it ($available)',
    async ({text, available}) => {
      setup();
      electron.readClipboard.mockResolvedValueOnce(text);
      expect(
        await handler(libraryEndpoints.clipboardAvailable.channel)(
          {},
          undefined,
        ),
      ).toBe(available);
      expect(electron.chooseFile).not.toHaveBeenCalled();
    },
  );

  it('coalesces queries, permits a file read, and drops availability after cleanup', async () => {
    const {stop} = setup();
    let resolve: (value: string) => void = () => undefined;
    electron.readClipboard.mockReturnValueOnce(
      new Promise(finish => {
        resolve = finish;
      }),
    );
    const query = handler(libraryEndpoints.clipboardAvailable.channel);
    const first = query({}, undefined);
    expect(query({}, undefined)).toBe(first);
    expect(electron.readClipboard).toHaveBeenCalledOnce();
    expect(
      await handler(libraryEndpoints.readText.channel)({}, readRequest),
    ).toEqual({
      ok: true,
      value: null,
    });
    stop();
    resolve('Invented text');
    expect(await first).toBe(false);
    expect(await query({}, undefined)).toBe(false);
    expect(electron.handlers.size).toBe(0);
  });

  it('logs a failed query and reports unavailable', async () => {
    const {log} = setup();
    electron.readClipboard.mockRejectedValueOnce(
      new Error('Clipboard unavailable'),
    );
    expect(
      await handler(libraryEndpoints.clipboardAvailable.channel)({}, undefined),
    ).toBe(false);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});
const previewRequest = {
  source: {
    source: 'clipboard',
    fileName: null,
    text: '[후렴]\nTitle\nOne\nTwo',
  },
  options: {
    split: 'lineBreak',
    unitsPerSlide: 2,
    labels: 'bracketLine',
    firstLine: 'title',
  },
};

describe('text import IPC registration', () => {
  it('reads a valid request through the file dialog and previews a valid one with the converter', async () => {
    const {control, log} = setup();
    const file = {
      source: 'file',
      fileName: 'Example.txt',
      text: 'One',
    } as const;
    vi.mocked(readTextImport).mockImplementationOnce(
      async (_request, inputs) => {
        expect(await inputs.chooseFile()).toBe('C:/data/Example.txt');
        return {ok: true, value: file};
      },
    );
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:/data/Example.txt'],
    });

    expect(
      await handler(libraryEndpoints.readText.channel)({}, readRequest),
    ).toEqual({ok: true, value: file});
    expect(readTextImport).toHaveBeenLastCalledWith(
      readRequest,
      expect.anything(),
    );
    expect(electron.chooseFile).toHaveBeenCalledExactlyOnceWith(control, {
      defaultPath: electron.tempDir,
      properties: ['openFile'],
      filters: [{name: '텍스트 파일', extensions: ['txt']}],
    });

    const converted: ReturnType<typeof convertTextImport> = {
      ok: true,
      value: {title: 'Title', slides: []},
    };
    vi.mocked(convertTextImport).mockReturnValueOnce(converted);
    expect(
      handler(libraryEndpoints.previewText.channel)({}, previewRequest),
    ).toBe(converted);
    expect(convertTextImport).toHaveBeenLastCalledWith(previewRequest);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('reads the file chosen last again, without a dialog, when asked to', async () => {
    setup();
    const file = {
      source: 'file',
      fileName: 'Example.txt',
      text: 'One',
    } as const;
    const chosen: string[] = [];
    const reading = async (
      _request: unknown,
      inputs: {readonly chooseFile: () => Promise<string | null>},
    ) => {
      const path = await inputs.chooseFile();
      if (path !== null) chosen.push(path);
      return {ok: true, value: file} as const;
    };
    vi.mocked(readTextImport)
      .mockImplementationOnce(reading)
      .mockImplementationOnce(reading);
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:/data/Example.txt'],
    });
    const read = handler(libraryEndpoints.readText.channel);
    await read({}, readRequest);
    await read({}, {...readRequest, encoding: 'cp949', again: true});

    expect(chosen).toEqual(['C:/data/Example.txt', 'C:/data/Example.txt']);
    expect(electron.chooseFile).toHaveBeenCalledOnce();
  });

  it('awaits clipboard text, preserves cancellation, and resets after input failure', async () => {
    const {log} = setup();
    const read = handler(libraryEndpoints.readText.channel);
    expect(await read({}, readRequest)).toEqual({ok: true, value: null});
    electron.readClipboard.mockRejectedValueOnce(new Error('Clipboard busy'));
    expect(
      await read({}, {source: 'clipboard', encoding: 'auto'}),
    ).toMatchObject({ok: false, error: {reason: 'read-failed'}});
    expect(log.warn).toHaveBeenCalledOnce();
    expect(await read({}, {source: 'clipboard', encoding: 'auto'})).toEqual({
      ok: true,
      value: {source: 'clipboard', fileName: null, text: 'Clipboard lyrics'},
    });
  });

  it('drops and logs malformed requests before opening a dialog or reading the clipboard', async () => {
    const {log} = setup();
    const invalidRead = await handler(libraryEndpoints.readText.channel)(
      {},
      {source: 'path', path: 'Example.txt', encoding: 'auto'},
    );
    const invalidPreview = handler(libraryEndpoints.previewText.channel)(
      {},
      {
        ...previewRequest,
        options: {...previewRequest.options, unitsPerSlide: 0},
      },
    );
    expect(invalidRead).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(invalidPreview).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(electron.chooseFile).not.toHaveBeenCalled();
    expect(electron.readClipboard).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  it('refuses native file dialogs in offscreen mode or after the control window closes', async () => {
    setup('offscreen');
    expect(
      await handler(libraryEndpoints.readText.channel)({}, readRequest),
    ).toMatchObject({ok: false, error: {reason: 'read-failed'}});
    expect(electron.chooseFile).not.toHaveBeenCalled();
  });

  it('reads the injected file in offscreen mode and ignores it in normal mode', async () => {
    const file = join(await makeTempDir(), 'Injected.txt');
    await writeFile(file, 'Injected lyrics', 'utf8');
    vi.stubEnv(TEST_IMPORT_FILE_VARIABLE, file);
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    const offscreen = setup('offscreen');
    expect(
      await handler(libraryEndpoints.readText.channel)({}, readRequest),
    ).toMatchObject({
      ok: true,
      value: {fileName: 'Injected.txt', text: 'Injected lyrics'},
    });
    expect(electron.chooseFile).not.toHaveBeenCalled();
    offscreen.stop();
    setup();
    await handler(libraryEndpoints.readText.channel)({}, readRequest);
    expect(electron.chooseFile).toHaveBeenCalledOnce();
  });

  it('refuses a native dialog after the control window closes', async () => {
    setup();
    electron.destroyed = true;
    expect(
      await handler(libraryEndpoints.readText.channel)({}, readRequest),
    ).toMatchObject({ok: false, error: {reason: 'read-failed'}});
    expect(electron.chooseFile).not.toHaveBeenCalled();
  });

  it('permits only one pending read and removes handlers before dropping a late result', async () => {
    const {stop} = setup();
    let resolve: (value: Selection) => void = () => {
      throw new Error('No pending selection');
    };
    electron.chooseFile.mockReturnValueOnce(
      new Promise<Selection>(done => {
        resolve = done;
      }),
    );
    const read = handler(libraryEndpoints.readText.channel);
    const preview = handler(libraryEndpoints.previewText.channel);
    const pending = read({}, readRequest);
    expect(await read({}, readRequest)).toMatchObject({
      ok: false,
      error: {reason: 'read-failed'},
    });
    expect(electron.chooseFile).toHaveBeenCalledOnce();
    stop();
    stop();
    expect(electron.handlers.size).toBe(0);
    resolve({canceled: true, filePaths: []});
    expect(await pending).toMatchObject({
      ok: false,
      error: {reason: 'read-failed'},
    });
    expect(await read({}, readRequest)).toMatchObject({
      ok: false,
      error: {reason: 'read-failed'},
    });
    expect(preview({}, previewRequest)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
  });
});
