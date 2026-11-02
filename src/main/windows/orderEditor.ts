import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {orderEditorEndpoints} from '@contracts/ipc/orderEditor';
import {windowEndpoints} from '@contracts/ipc/window';
import type {
  OpenWindowResult,
  OrderEditorTarget,
} from '@core/schema/ipcPayloads';
import type {AppConfigFile} from '../store/appConfigFile';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {registerControlClose, type ControlClose} from './controlClose';
import {createEditorWindow} from './editorWindow';
import {
  LIBRARY_RECT_SCRIPT,
  libraryRectOnScreen,
  ORDER_EDITOR_MIN_HEIGHT,
  ORDER_EDITOR_MIN_WIDTH,
  orderEditorPlacement,
  type Rect,
} from './orderEditorPlacement';
import type {WindowMode} from './testWindows';

const PAGE = {name: 'index', query: {window: 'order'}} as const;
const TITLE = '순서 편집';
const OPENED: OpenWindowResult = {ok: true, value: undefined};
const FAILED: OpenWindowResult = {ok: false, error: {reason: 'failed'}};

interface OrderEditorWindowOptions {
  readonly control: BrowserWindow;
  readonly config: Pick<
    AppConfigFile,
    'orderEditorWindow' | 'setOrderEditorWindow'
  >;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
}

export interface OrderEditorWindowRegistration {
  readonly close: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

async function readLibraryRect(
  control: BrowserWindow,
  log: Logger,
): Promise<Rect | null> {
  if (control.isDestroyed() || control.webContents.isDestroyed()) return null;
  try {
    const reply: unknown =
      await control.webContents.executeJavaScript(LIBRARY_RECT_SCRIPT);
    const {x, y} = control.getContentBounds();
    return libraryRectOnScreen(
      reply,
      {x, y},
      control.webContents.getZoomFactor(),
    );
  } catch (error) {
    log.warn('could not read where the library is', error);
    return null;
  }
}

/** Owns the one 순서 편집 window: opens, retargets, and releases it. */
export function registerOrderEditorWindow({
  control,
  config,
  zoom,
  mode,
  log,
}: OrderEditorWindowOptions): OrderEditorWindowRegistration {
  const openChannel = windowEndpoints.openOrderEditor.channel;
  const {
    target: targetEndpoint,
    slideSize,
    setSlideSize,
    retarget,
  } = orderEditorEndpoints;
  let win: BrowserWindow | null = null;
  let creating: Promise<BrowserWindow> | null = null;
  let closing: ControlClose | undefined;
  let target: OrderEditorTarget | null = null;
  let disposed = false;

  const placement = (
    window: BrowserWindow,
  ): NonNullable<typeof config.orderEditorWindow> => ({
    ...window.getNormalBounds(),
    maximized: window.isMaximized(),
    ...(config.orderEditorWindow?.slideSize === undefined
      ? {}
      : {slideSize: config.orderEditorWindow.slideSize}),
  });

  const remember = (): void => {
    if (mode === 'offscreen' || win === null || win.isDestroyed()) return;
    config.setOrderEditorWindow(placement(win));
  };

  const create = async (): Promise<BrowserWindow> => {
    const saved = config.orderEditorWindow;
    const library = await readLibraryRect(control, log);
    const bounds = orderEditorPlacement({
      saved,
      library,
      area: screen.getDisplayMatching(library ?? control.getBounds()).workArea,
    });
    const created = createEditorWindow({
      page: PAGE,
      title: TITLE,
      bounds,
      minWidth: ORDER_EDITOR_MIN_WIDTH,
      minHeight: ORDER_EDITOR_MIN_HEIGHT,
      maximized: saved?.maximized === true,
      zoom,
      mode,
      log,
    });
    created.on('move', remember);
    created.on('resize', remember);
    created.on('close', remember);
    const handshake = registerControlClose({control: created, log});
    closing = handshake;
    created.once('closed', () => {
      handshake.dispose();
      win = null;
      target = null;
      closing = undefined;
      if (control.isDestroyed()) app.quit();
    });
    return created;
  };

  const showTarget = async (next: OrderEditorTarget): Promise<void> => {
    target = next;
    // NOTE(0913vision): The first caller stored `creating` before it awaited,
    // so a second open always sees it and waits for the same window. If the
    // creation fails, both opens answer failed.
    if (creating !== null) {
      await creating;
    }
    if (win !== null && !win.isDestroyed()) {
      win.webContents.send(retarget.channel, next);
      if (mode === 'normal') {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
      return;
    }
    creating = create();
    try {
      win = await creating;
    } finally {
      creating = null;
    }
  };

  ipcMain.handle(
    openChannel,
    async (_event, value: unknown): Promise<OpenWindowResult> => {
      const request = windowEndpoints.openOrderEditor.request(value);
      if (!request.ok || disposed) return FAILED;
      try {
        await showTarget(request.value);
        return OPENED;
      } catch (error) {
        log.error('could not open the order editor window', error);
        return FAILED;
      }
    },
  );
  ipcMain.handle(targetEndpoint.channel, () => target);
  ipcMain.handle(
    slideSize.channel,
    () => config.orderEditorWindow?.slideSize ?? null,
  );
  const keepSlideSize = (_event: unknown, value: unknown): void => {
    const size = setSlideSize.message(value);
    if (!size.ok || win === null || win.isDestroyed()) return;
    config.setOrderEditorWindow({...placement(win), slideSize: size.value});
  };
  ipcMain.on(setSlideSize.channel, keepSlideSize);

  const close = async (): Promise<boolean> => {
    const current = win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await closing?.confirmClose())) return false;
    if (!current.isDestroyed()) {
      remember();
      current.destroy();
    }
    return true;
  };
  const closeAfterControl = (): void => {
    close().catch((error: unknown) =>
      log.error('could not close the order editor window', error),
    );
  };
  control.once('closed', closeAfterControl);
  return {
    close,
    dispose: async () => {
      if (disposed || !(await close())) return;
      disposed = true;
      ipcMain.removeHandler(openChannel);
      ipcMain.removeHandler(targetEndpoint.channel);
      ipcMain.removeHandler(slideSize.channel);
      ipcMain.removeListener(setSlideSize.channel, keepSlideSize);
      control.removeListener('closed', closeAfterControl);
    },
  };
}
