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
}));
vi.mock('electron', () => ({
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

it('answers only the control main frame, rejects arguments, and removes the handler', async () => {
  const control = {webContents: {mainFrame: {}}};
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
    expect(native.read).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
  expect(native.handlers.has(outputEndpoints.fonts.channel)).toBe(false);
});
