import {BrowserWindow, type HandlerDetails} from 'electron';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@main/displays/testing';
import {blockNavigation, loadPage, startLoading} from '@main/windows/page';

vi.mock('electron', async () => {
  const {EventEmitter} = await import('node:events');
  return {
    BrowserWindow: class MockBrowserWindow {
      readonly loadURL = vi.fn(() => Promise.resolve());
      readonly loadFile = vi.fn(() => Promise.resolve());
      readonly webContents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler: vi.fn(),
      });
    },
  };
});

function mockWindow() {
  return new BrowserWindow();
}

afterEach(() => vi.unstubAllEnvs());

describe('startLoading', () => {
  it('loads from the dev server with the query when there is one', async () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');
    const win = mockWindow();
    await startLoading(win, {name: 'output', query: {screen: 'main', n: '2'}});
    expect(win.loadURL).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:5173/output.html?screen=main&n=2',
    );
    expect(win.loadFile).not.toHaveBeenCalled();
  });

  it('adds no question mark when the query is empty', async () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');
    const win = mockWindow();
    await startLoading(win, {name: 'index'});
    expect(win.loadURL).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:5173/index.html',
    );
  });

  it.each([undefined, ''])(
    'loads the built file when the dev server is %j',
    async devServer => {
      vi.stubEnv('ELECTRON_RENDERER_URL', devServer);
      const win = mockWindow();
      await startLoading(win, {name: 'analysis', query: {id: '7'}});
      expect(win.loadURL).not.toHaveBeenCalled();
      expect(win.loadFile).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(/renderer[/\\]analysis\.html$/u),
        {query: {id: '7'}},
      );
    },
  );
});

describe('loadPage', () => {
  it('logs a page that fails to load instead of throwing', async () => {
    const win = mockWindow();
    const failure = new Error('invented load failure');
    vi.mocked(win.loadFile).mockRejectedValue(failure);
    const log = recordingLogger();
    loadPage(win, {name: 'output'}, log);
    await vi.waitFor(() =>
      expect(log.messages('error')).toEqual(['failed to load output']),
    );
    expect(log.entries[0]?.detail).toBe(failure);
  });
});

describe('blockNavigation', () => {
  it('cancels navigation and denies new windows', () => {
    const win = mockWindow();
    blockNavigation(win);
    const event = {preventDefault: vi.fn()};
    win.webContents.emit('will-navigate', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    const open = vi.mocked(win.webContents.setWindowOpenHandler).mock
      .calls[0]?.[0];
    const details = {
      url: 'https://example.invalid',
      frameName: '',
      features: '',
      disposition: 'new-window',
      referrer: {url: '', policy: 'default'},
    } satisfies HandlerDetails;
    expect(open?.(details)).toEqual({action: 'deny'});
  });
});
