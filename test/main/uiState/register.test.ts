import {afterEach, describe, expect, it, vi} from 'vitest';
import {uiEndpoints} from '@contracts/ipc/ui';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {UiFields, UiStateFields} from '@main/store/appConfigFile';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));

const {registerUiState} = await import('@main/uiState/register');

const stops: Array<() => void> = [];

function register(initial: UiFields = {}) {
  let current = initial;
  const fields: UiStateFields = {
    read: () => current,
    change: next => {
      current = {...current, ...next};
    },
  };
  const log = recordingLogger();
  const {dispose} = registerUiState(fields, log);
  stops.push(dispose);
  return {dispose, log, current: () => current};
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe('registerUiState', () => {
  it('removes its channels when it is disposed', () => {
    const {dispose} = register();
    dispose();
    expect(ipc.open()).toBe(0);
  });

  it('keeps what each message changes and answers reads with it', async () => {
    register();
    ipc.send(uiEndpoints.setLayout, {
      sizeClass: 'narrow',
      thumbnailScalePercent: 120,
    });
    ipc.send(uiEndpoints.setMediaStrip, {visible: false});
    ipc.send(uiEndpoints.setMediaBrowser, {columns: 6});
    ipc.send(uiEndpoints.setRememberedView, {showToolTab: 'timer'});
    expect(await ipc.invoke(uiEndpoints.get)).toEqual({
      layout: {narrow: {thumbnailScalePercent: 120}},
      mediaStrip: false,
      mediaBrowser: {columns: 6},
      showToolTab: 'timer',
    });
  });

  it.each([
    [uiEndpoints.setLayout, {sizeClass: 'huge', thumbnailScalePercent: 100}],
    [uiEndpoints.setLayout, {sizeClass: 'normal', left: 300}],
    [uiEndpoints.setMediaStrip, {visible: 'false'}],
    [uiEndpoints.setMediaBrowser, {columns: 9}],
    [uiEndpoints.setRememberedView, {showToolTab: 'wrong'}],
  ])('drops and logs a malformed message %#', (endpoint, value) => {
    const {log, current} = register({mediaStrip: true});
    ipc.send(endpoint, value);
    expect(current()).toEqual({mediaStrip: true});
    expect(log.messages('warn')).toHaveLength(1);
  });
});
