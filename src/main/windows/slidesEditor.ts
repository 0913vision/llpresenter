import {ipcMain, type BrowserWindow} from 'electron';
import {
  slidesEditorEndpoints,
  type SlidesEditorTarget,
} from '@contracts/ipc/slidesEditor';
import type {OpenWindowResult} from '@core/schema/ipcPayloads';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import type {WindowMode} from './testWindows';

interface SlidesEditorOptions {
  readonly control: BrowserWindow;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly log: Logger;
  readonly mode: WindowMode;
  readonly hasItem: (target: SlidesEditorTarget) => Promise<boolean>;
}

/** Routes existing slide editor requests to the control workspace. */
export function registerSlidesEditorWindow(options: SlidesEditorOptions) {
  const {control, log, hasItem} = options;
  let target: SlidesEditorTarget | null = null;
  let disposed = false;
  const isDisposed = (): boolean => disposed || control.isDestroyed();
  const open = async (
    requested: SlidesEditorTarget,
  ): Promise<OpenWindowResult> => {
    if (isDisposed()) return {ok: false, error: {reason: 'failed'}};
    if (!(await hasItem(requested))) {
      return {ok: false, error: {reason: 'no-such-target'}};
    }
    if (isDisposed()) return {ok: false, error: {reason: 'failed'}};
    target = requested;
    control.webContents.send(slidesEditorEndpoints.retarget.channel, target);
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
  const close = (): Promise<boolean> => Promise.resolve(true);
  return {
    close,
    dispose: async (): Promise<void> => {
      if (disposed || !(await close())) return;
      disposed = true;
      ipcMain.removeHandler(endpoints.open.channel);
      ipcMain.removeHandler(endpoints.target.channel);
    },
  };
}
