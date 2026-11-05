import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {
  slidesEditorEndpoints,
  type SlidesEditorTarget,
} from '@contracts/ipc/slidesEditor';
import type {OpenWindowResult} from '@core/schema/ipcPayloads';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {createEditorWindow} from './editorWindow';
import {registerControlClose, type ControlClose} from './controlClose';
import type {WindowMode} from './testWindows';

const WIDTH = 1280;
const HEIGHT = 820;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 600;

interface SlidesEditorOptions {
  readonly control: BrowserWindow;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly log: Logger;
  readonly mode: WindowMode;
  readonly hasItem: (target: SlidesEditorTarget) => Promise<boolean>;
}

/** Owns one reusable slides editor and its close preflight. */
export function registerSlidesEditorWindow(options: SlidesEditorOptions) {
  const {control, log, mode, hasItem} = options;
  let win: BrowserWindow | null = null;
  let closing: ControlClose | undefined;
  let target: SlidesEditorTarget | null = null;
  let disposed = false;
  const isDisposed = (): boolean => disposed;
  const open = async (
    requested: SlidesEditorTarget,
  ): Promise<OpenWindowResult> => {
    if (isDisposed()) return {ok: false, error: {reason: 'failed'}};
    if (!(await hasItem(requested))) {
      return {ok: false, error: {reason: 'no-such-target'}};
    }
    if (isDisposed()) return {ok: false, error: {reason: 'failed'}};
    target = requested;
    if (win !== null && !win.isDestroyed()) {
      win.webContents.send(slidesEditorEndpoints.retarget.channel, target);
      if (mode === 'normal') {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
      return {ok: true, value: undefined};
    }
    const bounds = control.getNormalBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const width = Math.min(WIDTH, area.width);
    const height = Math.min(HEIGHT, area.height);
    const created = createEditorWindow({
      ...options,
      page: {name: 'index', query: {window: 'slides'}},
      title: '슬라이드 편집',
      bounds: {
        x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
        y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
        width,
        height,
      },
      minWidth: Math.min(MIN_WIDTH, area.width),
      minHeight: Math.min(MIN_HEIGHT, area.height),
      maximized: false,
    });
    win = created;
    const handshake = registerControlClose({control: created, log});
    closing = handshake;
    created.once('closed', () => {
      handshake.dispose();
      if (win !== created) return;
      win = null;
      closing = undefined;
      target = null;
      if (control.isDestroyed()) app.quit();
    });
    return {ok: true, value: undefined};
  };
  const endpoints = slidesEditorEndpoints;
  ipcMain.handle(endpoints.open.channel, async (_event, value: unknown) => {
    const parsed = endpoints.open.request(value);
    if (!parsed.ok) return endpoints.open.refuse?.(parsed.error);
    try {
      return await open(parsed.value);
    } catch (error) {
      log.error('Could not open the slides editor', error);
      return {ok: false, error: {reason: 'failed'}};
    }
  });
  ipcMain.handle(endpoints.target.channel, () => target);
  const saved = (event: Electron.IpcMainEvent, value: unknown): void => {
    if (event.sender !== win?.webContents || control.isDestroyed()) {
      return;
    }
    const parsed = endpoints.saved.message(value);
    if (!parsed.ok) {
      log.error('Invalid slides editor history', parsed.error);
      return;
    }
    const {before, after} = parsed.value;
    if (after.id !== before.id) return;
    control.webContents.send(endpoints.savedInControl.channel, parsed.value);
  };
  ipcMain.on(endpoints.saved.channel, saved);
  const close = async (): Promise<boolean> => {
    const current = win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await closing?.confirmClose())) return false;
    if (!current.isDestroyed()) current.destroy();
    return true;
  };
  const closeAfterControl = (): void => {
    close().catch((error: unknown) =>
      log.error('Could not close the slides editor', error),
    );
  };
  control.once('closed', closeAfterControl);
  return {
    close,
    dispose: async (): Promise<void> => {
      if (disposed || !(await close())) return;
      disposed = true;
      ipcMain.removeHandler(endpoints.open.channel);
      ipcMain.removeHandler(endpoints.target.channel);
      ipcMain.removeListener(endpoints.saved.channel, saved);
      control.removeListener('closed', closeAfterControl);
    },
  };
}
