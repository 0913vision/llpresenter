import {expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import type {PictureRequest} from '@core/schema/picture';
import {createIpcPort} from '../../src/preload/port';
import {picturePreload} from '../../src/preload/picture';

it('validates synchronous reservations and refuses invalid replies', () => {
  const sendSync = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce('yes');
  const ipc = {
    sendSync,
    send: vi.fn(),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
  const api = picturePreload(createIpcPort(ipc, vi.fn()), ipc);
  const screen = createScreenId('00000000-0000-4000-8000-000000000001');
  const request: PictureRequest = {
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
  expect(api.reserve({...request, inputs: 'x'.repeat(100_001)})).toBe(false);
  expect(sendSync).not.toHaveBeenCalled();
  expect(api.reserve(request)).toBe(true);
  expect(api.reserve(request)).toBe(false);
  expect(sendSync).toHaveBeenCalledTimes(2);
});
