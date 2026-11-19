import {expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {pictureEndpoints} from '@contracts/ipc/picture';

const mocks = vi.hoisted(() => ({reserve: vi.fn(), dispose: vi.fn()}));
vi.mock('@main/windows/pictureCache', () => ({
  PictureCache: class {
    reserve = mocks.reserve;
    dispose = mocks.dispose;
  },
}));
vi.mock('electron', async () => {
  const {EventEmitter} = await import('node:events');
  const ipc = new EventEmitter();
  return {
    app: Object.assign(new EventEmitter(), {getPath: () => 'test-data'}),
    ipcMain: Object.assign(ipc, {handle: vi.fn(), removeHandler: vi.fn()}),
  };
});

it('answers synchronous reservations during shutdown until Electron quits', async () => {
  const {app, ipcMain} = await import('electron');
  const {registerPictureChannels} =
    await import('@main/windows/pictureChannels');
  mocks.reserve.mockReturnValue(true);
  mocks.dispose.mockResolvedValue(undefined);
  const stop = registerPictureChannels();
  const frame = {};
  const event = {
    senderFrame: frame,
    sender: {mainFrame: frame, id: 7},
    returnValue: undefined,
  };
  const screen = createScreenId('00000000-0000-4000-8000-000000000001');
  const request = {
    inputs: 'inputs',
    spec: {
      layers: emptyLayers(),
      appearance: {
        screen: {id: screen, kind: 'audience'},
        theme: {
          themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
          revision: 0,
          missing: [],
          item: null,
          sourceScreenId: screen,
          layout: {mode: {kind: 'own'}, elements: []},
          emptyColor: '#000000',
        },
        background: '#000000',
        checker: false,
      },
    },
  };
  ipcMain.emit(pictureEndpoints.reserve, event, request);
  expect(event.returnValue).toBe(true);
  await stop();
  event.returnValue = undefined;
  ipcMain.emit(pictureEndpoints.reserve, event, request);
  expect(event.returnValue).toBe(false);
  expect(mocks.reserve).toHaveBeenCalledOnce();
  Reflect.apply(app.emit, app, ['will-quit', {}]);
  expect(ipcMain.listenerCount(pictureEndpoints.reserve)).toBe(0);
});
