import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {
  parseTextImportReadResult,
  parseTextImportPreviewResult,
} from '@core/schema/textImport';
import {makeTempDir} from '../../../test/temp-dir';
import {registerTextImport, TEST_IMPORT_FILE_VARIABLE} from './register';
import {TEXT_IMPORT_LIMITS} from './limits';

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
}));

vi.mock('electron', () => ({
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
  it('answers read and preview with validated values and a single text-file dialog', async () => {
    const {control, log} = setup();
    const folder = await makeTempDir();
    const path = join(folder, 'Example.txt');
    await writeFile(path, 'One\nTwo');
    electron.chooseFile.mockResolvedValueOnce({
      canceled: false,
      filePaths: [path],
    });
    const read = await handler(libraryEndpoints.readText.channel)(
      {},
      readRequest,
    );
    expect(read).toEqual({
      ok: true,
      value: {source: 'file', fileName: 'Example.txt', text: 'One\nTwo'},
    });
    expect(parseTextImportReadResult(read).ok).toBe(true);
    expect(electron.chooseFile).toHaveBeenCalledExactlyOnceWith(control, {
      properties: ['openFile'],
      filters: [{name: '텍스트 파일', extensions: ['txt']}],
    });
    const preview = handler(libraryEndpoints.previewText.channel)(
      {},
      previewRequest,
    );
    expect(preview).toEqual({
      ok: true,
      value: {
        title: 'Title',
        slides: [{label: '후렴', lines: ['One', 'Two'], section: 0}],
      },
    });
    expect(parseTextImportPreviewResult(preview).ok).toBe(true);
    expect(log.warn).not.toHaveBeenCalled();
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
