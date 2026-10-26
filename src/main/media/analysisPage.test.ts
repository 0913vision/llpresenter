import {beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {openAnalysisPage} from './analysisPage';

type Listener = (event: unknown, details: unknown) => void;

const fakes = vi.hoisted(() => ({
  options: new Array<unknown>(),
  windows: new Array<{
    destroyed: boolean;
    listeners: Map<string, Listener>;
    script: string[];
  }>(),
  reply: (): unknown => ({ok: true}),
  startLoading: vi.fn<(win: unknown, page: unknown) => Promise<void>>(),
  blockNavigation: vi.fn<(win: unknown) => void>(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    private readonly state = {
      destroyed: false,
      listeners: new Map<string, Listener>(),
      script: new Array<string>(),
    };
    readonly webContents = {
      on: (event: string, listener: Listener) => {
        this.state.listeners.set(event, listener);
      },
      executeJavaScript: (script: string) => {
        this.state.script.push(script);
        return Promise.resolve(fakes.reply());
      },
    };

    constructor(options: unknown) {
      fakes.options.push(options);
      fakes.windows.push(this.state);
    }

    isDestroyed() {
      return this.state.destroyed;
    }

    destroy() {
      this.state.destroyed = true;
    }
  },
}));

vi.mock('../windows/page', () => ({
  startLoading: fakes.startLoading,
  blockNavigation: fakes.blockNavigation,
}));

beforeEach(() => {
  fakes.options.length = 0;
  fakes.windows.length = 0;
  fakes.startLoading.mockReset();
  fakes.startLoading.mockResolvedValue(undefined);
  fakes.blockNavigation.mockReset();
});

const JOB = {
  url: 'llp-media://analysis/invented',
  kind: 'video',
  thumbnail: {width: 320, height: 180},
} as const;

describe('the hidden analysis page', () => {
  it('opens a sandboxed window that never shows, without a preload', async () => {
    await openAnalysisPage(recordingLogger());
    expect(fakes.options).toHaveLength(1);
    expect(fakes.options[0]).toMatchObject({
      show: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    expect(fakes.options[0]).not.toHaveProperty('webPreferences.preload');
    expect(fakes.blockNavigation).toHaveBeenCalledOnce();
    expect(fakes.startLoading).toHaveBeenCalledWith(expect.anything(), {
      name: 'analysis',
    });
  });

  it("runs a job through the page's analyseMedia and answers its reply", async () => {
    const page = await openAnalysisPage(recordingLogger());
    fakes.reply = () => ({ok: true, duration: 2});
    expect(await page.run(JOB)).toEqual({ok: true, duration: 2});
    expect(fakes.windows[0]?.script).toEqual([
      `window.analyseMedia(${JSON.stringify(JOB)})`,
    ]);
  });

  it('closes the window once, and logs a page that stopped', async () => {
    const log = recordingLogger();
    const page = await openAnalysisPage(log);
    fakes.windows[0]?.listeners.get('render-process-gone')?.(
      {},
      {reason: 'crashed'},
    );
    expect(log.messages('warn')).toEqual(['the media analysis page stopped']);
    page.close();
    page.close();
    expect(fakes.windows[0]?.destroyed).toBe(true);
  });

  it('closes the window and rejects when the page cannot load', async () => {
    fakes.startLoading.mockRejectedValue(new Error('Invented load failure'));
    await expect(openAnalysisPage(recordingLogger())).rejects.toThrow(
      'Invented load failure',
    );
    expect(fakes.windows[0]?.destroyed).toBe(true);
  });
});
