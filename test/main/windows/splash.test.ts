import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LaunchPlan} from '@main/windows/splash';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  const created: MockWindow[] = [];
  class MockWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      executeJavaScript: vi.fn<(code: string) => Promise<void>>(() =>
        Promise.resolve(),
      ),
    });
    readonly loadURL = vi
      .fn<(_url: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    readonly show = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  return {MockWindow, created};
});
vi.mock('electron', () => ({BrowserWindow: electron.MockWindow}));

const {createSplash, LaunchBar} = await import('@main/windows/splash');

const PLAN: LaunchPlan = {
  elapsed: 0,
  tasks: [
    {
      id: 'files',
      label: '곡과 예배 파일 읽는 중',
      name: '곡과 예배 파일',
      endsAt: 100,
      counted: true,
    },
  ],
};

function only() {
  const window = electron.created[0];
  if (window === undefined) throw new Error('Missing splash');
  return window;
}

beforeEach(() => {
  electron.created.length = 0;
});

describe('launch window', () => {
  it('tells its page what happened before it was loaded, in order', () => {
    const splash = createSplash('offscreen');
    const {executeJavaScript} = only().webContents;
    const bar = new LaunchBar(splash, PLAN);
    bar.advance('files', 1, 3);
    expect(executeJavaScript).not.toHaveBeenCalled();
    only().webContents.emit('did-finish-load');
    bar.end('files', false);
    expect(executeJavaScript.mock.calls.map(([code]) => code)).toEqual([
      `launch.begin(${JSON.stringify(PLAN)})`,
      'launch.advance("files",1,3)',
      'launch.end("files",false)',
    ]);
  });

  it('leaves out counts that follow each other at once, but not the last', () => {
    const splash = createSplash('offscreen');
    only().webContents.emit('did-finish-load');
    const bar = new LaunchBar(splash, PLAN);
    for (let done = 1; done <= 5; done++) bar.advance('files', done, 5);
    const codes = only().webContents.executeJavaScript.mock.calls.map(
      ([code]) => code,
    );
    expect(codes).toHaveLength(3);
    expect(codes.at(-1)).toBe('launch.advance("files",5,5)');
  });

  it('tells nothing to a window that is gone', () => {
    const splash = createSplash('offscreen');
    only().webContents.emit('did-finish-load');
    const bar = new LaunchBar(splash, PLAN);
    only().isDestroyed.mockReturnValue(true);
    bar.end('files', false);
    expect(only().webContents.executeJavaScript).toHaveBeenCalledOnce();
  });

  it('uses a blue background and shows the inline design only after the first paint', () => {
    createSplash('normal');
    const window = only();
    expect(window.options).toMatchObject({
      show: false,
      backgroundColor: '#1f4170',
    });
    expect(window.show).not.toHaveBeenCalled();
    const url = window.loadURL.mock.calls[0]?.[0];
    if (url === undefined) throw new Error('Missing splash HTML');
    const html = decodeURIComponent(url);
    expect(html).toContain('<svg');
    expect(html).toContain('LoveLight Presenter');
    window.emit('ready-to-show');
    expect(window.show).toHaveBeenCalledOnce();
  });

  it('never shows an offscreen launch window', () => {
    createSplash('offscreen');
    only().emit('ready-to-show');
    expect(only().show).not.toHaveBeenCalled();
  });

  it('does not show a window already closed during startup', () => {
    createSplash('normal');
    only().isDestroyed.mockReturnValue(true);
    only().emit('ready-to-show');
    expect(only().show).not.toHaveBeenCalled();
  });
});
