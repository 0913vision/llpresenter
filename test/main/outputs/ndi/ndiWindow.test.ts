import {expect, it, vi} from 'vitest';
import {
  createNdiWindow,
  ndiOutputHandle,
  type NdiSender,
} from '@main/outputs/ndi/ndiWindow';
import {
  NDI_FRAME_HEIGHT,
  NDI_FRAME_WIDTH,
} from '@main/outputs/ndi/textureQueue';
import type {OutputScreen} from '@main/outputs/screens';

vi.mock('electron', async () => {
  const {EventEmitter} = await import('node:events');
  class BrowserWindow extends EventEmitter {
    readonly options: unknown;
    readonly webContents = Object.assign(new EventEmitter(), {
      stopPainting: vi.fn(),
      setFrameRate: vi.fn(),
      forcefullyCrashRenderer: vi.fn(),
      executeJavaScript: vi.fn(async () => 0),
    });
    destroyed = false;
    constructor(options: unknown) {
      super();
      this.options = options;
    }
    setMinimumSize = vi.fn();
    setContentSize = vi.fn();
    isDestroyed(): boolean {
      return this.destroyed;
    }
  }
  return {BrowserWindow};
});
vi.mock('@main/base/renderers/page', () => ({
  blockNavigation: vi.fn(),
  startLoading: vi.fn(async () => undefined),
}));

const SCREEN: OutputScreen = {
  id: 'broadcast',
  name: '방송 화면',
  kind: 'broadcast',
  method: 'capture',
  target: 'ndi',
  display: null,
  onDisconnect: 'window',
};

function sender() {
  return {
    configure: vi.fn<NdiSender['configure']>(),
    begin: vi.fn<NdiSender['begin']>(),
    stop: vi.fn<NdiSender['stop']>(),
    requestFrame: vi.fn<NdiSender['requestFrame']>(),
    destroy: vi.fn<NdiSender['destroy']>(),
  };
}

it('draws one hidden NDI frame, at 60 frames for a fast screen and 30 for a slow one', () => {
  const events = {onRendererGone: vi.fn(), onCloseRequested: vi.fn()};
  const fast = createNdiWindow({...SCREEN, ndi: {fps: 60}}, events, {
    sharedTexture: true,
    onLoadError: vi.fn(),
  });
  expect(fast.win.webContents.stopPainting).toHaveBeenCalledOnce();
  expect(fast.win.webContents.setFrameRate).toHaveBeenCalledWith(60);
  expect(fast.win.setContentSize).toHaveBeenCalledWith(
    NDI_FRAME_WIDTH,
    NDI_FRAME_HEIGHT,
  );
  const slow = createNdiWindow({...SCREEN, ndi: {fps: 30}}, events, {
    sharedTexture: false,
    onLoadError: vi.fn(),
  });
  expect(slow.win.webContents.stopPainting).not.toHaveBeenCalled();
  expect(slow.win.webContents.setFrameRate).toHaveBeenCalledWith(30);
});

it('sends while shown as a capture, stops when hidden, and places nothing', async () => {
  const events = {onRendererGone: vi.fn(), onCloseRequested: vi.fn()};
  const ndi = createNdiWindow(SCREEN, events, {
    sharedTexture: false,
    onLoadError: vi.fn(),
  });
  const send = sender();
  const handle = ndiOutputHandle(ndi, send);
  const bounds = {x: 0, y: 0, width: 1920, height: 1080};
  handle.showFullScreen(bounds, true);
  handle.showWindowed(bounds, true);
  handle.prepare(bounds, 'fullscreen');
  handle.setAlwaysOnTop(true);
  handle.bringToFront();
  handle.prepareForMonitorRemoval();
  expect(send.begin).not.toHaveBeenCalled();
  handle.showCapture(bounds, false);
  expect(send.begin).toHaveBeenCalledOnce();
  handle.requestFrame();
  expect(send.requestFrame).toHaveBeenCalledOnce();
  handle.hide();
  expect(send.stop).toHaveBeenCalledOnce();
  expect(handle.bounds()).toBeNull();
  expect(handle.contentSize()).toEqual({
    width: NDI_FRAME_WIDTH,
    height: NDI_FRAME_HEIGHT,
  });
  await handle.ping();
  expect(ndi.win.webContents.executeJavaScript).toHaveBeenCalledWith('0');
  handle.crashRenderer();
  expect(ndi.win.webContents.forcefullyCrashRenderer).toHaveBeenCalledOnce();
  expect(handle.previewContents?.()).toBe(ndi.win.webContents);
  handle.destroy();
  expect(send.destroy).toHaveBeenCalledOnce();
});
