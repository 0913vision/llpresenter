import {BrowserWindow} from 'electron';
import type {PictureRequest} from '@core/schema/picture';
import {blockNavigation, preloadPath, startLoading} from './page';
import {outputTransitionActive} from '../outputs/transitionActivity';

const WIDTH = 1920;
const HEIGHT = 1080;
const TRANSITION_PAINT_PAUSE_MS = 80;

/** A single offscreen compositor, serialized so captures cannot overlap. */
export class PicturePainter {
  private window: BrowserWindow | undefined;
  private loading: Promise<void> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private stopped = false;

  paint(request: PictureRequest): Promise<Buffer> {
    const result = this.queue.then(async () => {
      if (outputTransitionActive()) {
        await new Promise<void>(resolve => {
          setTimeout(resolve, TRANSITION_PAINT_PAUSE_MS);
        });
      }
      const win = await this.ready();
      const data = JSON.stringify(JSON.stringify(request));
      const contents = win.webContents;
      contents.startPainting();
      try {
        await contents.executeJavaScript(
          `window.drawPicture(JSON.parse(${data}))`,
        );
        const image = await contents.capturePage();
        if (image.isEmpty()) throw new Error('Painter returned an empty image');
        return request.spec.appearance.screen.method === 'ndi'
          ? image.toPNG()
          : image.toJPEG(85);
      } finally {
        if (!contents.isDestroyed()) contents.stopPainting();
      }
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  dispose(): void {
    this.stopped = true;
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = undefined;
    this.loading = undefined;
  }

  private async ready(): Promise<BrowserWindow> {
    if (this.stopped) throw new Error('Picture painter has stopped');
    if (this.window === undefined || this.window.isDestroyed()) {
      const win = new BrowserWindow({
        width: WIDTH,
        height: HEIGHT,
        useContentSize: true,
        frame: false,
        show: false,
        skipTaskbar: true,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: preloadPath,
          offscreen: true,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      win.setMinimumSize(WIDTH, HEIGHT);
      win.setContentSize(WIDTH, HEIGHT);
      win.webContents.setFrameRate(60);
      win.webContents.setAudioMuted(true);
      blockNavigation(win);
      this.window = win;
      this.loading = startLoading(win, {name: 'output', query: {painter: '1'}});
    }
    await this.loading;
    return this.window;
  }
}
