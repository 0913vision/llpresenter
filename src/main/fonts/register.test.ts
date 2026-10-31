import {afterEach, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import type {Logger} from '../log';
import {registerFonts} from './register';

interface Event {
  readonly sender: object;
  readonly senderFrame: object;
}
type Handler = (event: Event, ...args: unknown[]) => unknown;
const native = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  read: vi.fn(),
  fromWebContents: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: {fromWebContents: native.fromWebContents},
  ipcMain: {
    handle: (name: string, handler: Handler) =>
      native.handlers.set(name, handler),
    removeHandler: (name: string) => native.handlers.delete(name),
  },
}));
vi.mock('./windowsFonts', () => ({readWindowsFonts: native.read}));

afterEach(() => {
  native.handlers.clear();
  vi.clearAllMocks();
});

it('answers trusted main frames, rejects foreign output pages and arguments, and removes the handler', async () => {
  const control = {
    webContents: {mainFrame: {}, getURL: () => 'file:///app/index.html'},
  };
  const log: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
  native.read.mockResolvedValue([fontFamilyFixture()]);
  const stop = registerFonts(control, log);
  try {
    const ask = native.handlers.get(outputEndpoints.fonts.channel);
    if (ask === undefined) throw new Error('Missing fonts handler');
    expect(() =>
      ask({sender: {}, senderFrame: control.webContents.mainFrame}),
    ).toThrow('Invalid');
    expect(() => ask({sender: control.webContents, senderFrame: {}})).toThrow(
      'Invalid',
    );
    const event = {
      sender: control.webContents,
      senderFrame: control.webContents.mainFrame,
    };
    expect(() => ask(event, {})).toThrow('Invalid');
    expect(native.read).not.toHaveBeenCalled();
    await expect(ask(event)).resolves.toEqual([fontFamilyFixture()]);
    await expect(ask(event)).resolves.toEqual([fontFamilyFixture()]);
    const output = {
      mainFrame: {},
      getURL: () => 'file:///app/output.html?screen=main',
    };
    native.fromWebContents.mockReturnValue({});
    await expect(
      ask({sender: output, senderFrame: output.mainFrame}),
    ).resolves.toEqual([fontFamilyFixture()]);
    const screens = {
      ...output,
      getURL: () => 'file:///app/index.html?window=screens',
    };
    await expect(
      ask({sender: screens, senderFrame: screens.mainFrame}),
    ).resolves.toEqual([fontFamilyFixture()]);
    expect(() => ask({sender: output, senderFrame: {}})).toThrow('Invalid');
    const foreign = {...output, getURL: () => 'file:///other/output.html'};
    expect(() =>
      ask({sender: foreign, senderFrame: foreign.mainFrame}),
    ).toThrow('Invalid');
    native.fromWebContents.mockReturnValue(null);
    expect(() => ask({sender: output, senderFrame: output.mainFrame})).toThrow(
      'Invalid',
    );
    expect(native.read).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
  expect(native.handlers.has(outputEndpoints.fonts.channel)).toBe(false);
});
