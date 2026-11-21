import {beforeEach, describe, expect, it, vi} from 'vitest';
import {completeSplashStep, createSplash} from '@main/windows/splash';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  const created: MockWindow[] = [];
  class MockWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      executeJavaScript: vi.fn(() => Promise.resolve()),
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

beforeEach(() => {
  electron.created.length = 0;
});

describe('launch window', () => {
  it('counts completed milestones once, including work finished before the splash loads', () => {
    const splash = createSplash('offscreen');
    const window = electron.created[0];
    if (window === undefined) throw new Error('Missing splash');
    completeSplashStep(splash, 'window');
    completeSplashStep(splash, 'window');
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    window.webContents.emit('did-finish-load');
    expect(window.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("width='17%'"),
    );
    completeSplashStep(splash, 'content');
    expect(window.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("width='33%'"),
    );
    completeSplashStep(splash, 'settings');
    completeSplashStep(splash, 'renderer');
    completeSplashStep(splash, 'paint');
    expect(window.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("width='83%'"),
    );
    completeSplashStep(splash, 'pregrid');
    expect(window.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("width='100%'"),
    );
  });
  it('uses a blue background and shows the inline design only after the first paint', () => {
    createSplash('normal');
    const window = electron.created[0];
    if (window === undefined) throw new Error('Missing splash');
    expect(window.options).toMatchObject({
      show: false,
      backgroundColor: '#1f4170',
    });
    expect(window.show).not.toHaveBeenCalled();
    const url = window.loadURL.mock.calls[0]?.[0];
    if (url === undefined) throw new Error('Missing splash HTML');
    const html = decodeURIComponent(url);
    expect(html).toContain('설정 불러오는 중');
    expect(html).toContain('<svg');
    expect(html).toContain('LoveLight Presenter');
    window.emit('ready-to-show');
    expect(window.show).toHaveBeenCalledOnce();
  });

  it('never shows an offscreen launch window', () => {
    createSplash('offscreen');
    const window = electron.created[0];
    if (window === undefined) throw new Error('Missing splash');
    window.emit('ready-to-show');
    expect(window.show).not.toHaveBeenCalled();
  });

  it('does not show a window already closed during startup', () => {
    createSplash('normal');
    const window = electron.created[0];
    if (window === undefined) throw new Error('Missing splash');
    window.isDestroyed.mockReturnValue(true);
    window.emit('ready-to-show');
    expect(window.show).not.toHaveBeenCalled();
  });
});
