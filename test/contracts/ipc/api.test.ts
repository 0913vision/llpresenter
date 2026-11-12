import {describe, expect, it} from 'vitest';
import {llpApi} from '@contracts/ipc/api';
import {appEndpoints} from '@contracts/ipc/app';
import {updateEndpoints} from '@contracts/ipc/update';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {contentEndpoints} from '@contracts/ipc/content';
import type {IpcPort, WindowPlatform} from '@contracts/ipc/endpoint';
import {libraryEndpoints} from '@contracts/ipc/library';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {liveEndpoints} from '@contracts/ipc/live';
import {mediaEndpoints} from '@contracts/ipc/media';
import {locationsEndpoints} from '@contracts/ipc/locations';
import {outputEndpoints} from '@contracts/ipc/output';
import {recoveryEndpoints} from '@contracts/ipc/recovery';
import {serviceEndpoints} from '@contracts/ipc/service';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {slidesEditorEndpoints} from '@contracts/ipc/slidesEditor';
import {uiEndpoints} from '@contracts/ipc/ui';
import {windowEndpoints} from '@contracts/ipc/window';

function endpointsIn(table: object): object[] {
  return Object.values(table).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    return 'channel' in entry ? [entry] : endpointsIn(entry);
  });
}

const DECLARED = [
  appEndpoints,
  updateEndpoints,
  bibleEndpoints,
  contentEndpoints,
  libraryEndpoints,
  powerpointEndpoints,
  liveEndpoints,
  mediaEndpoints,
  recoveryEndpoints,
  serviceEndpoints,
  settingsEndpoints,
  uiEndpoints,
  windowEndpoints,
  outputEndpoints,
  locationsEndpoints,
  songEditorWindowEndpoints,
  slidesEditorEndpoints,
].flatMap(endpointsIn);

function recordingPort() {
  const used: object[] = [];
  const record = (endpoint: object) => {
    used.push(endpoint);
    return () => undefined;
  };
  const port: IpcPort = {
    query: endpoint => {
      record(endpoint);
      return () => Promise.reject(new Error('Not sent in this test'));
    },
    request: endpoint => {
      record(endpoint);
      return () => Promise.reject(new Error('Not sent in this test'));
    },
    signal: record,
    message: record,
    partialMessage: record,
    subscribe: endpoint => {
      record(endpoint);
      return () => () => undefined;
    },
  };
  return {port, used};
}

const PLATFORM: WindowPlatform = {pathForFile: () => '', zoomFactor: () => 1};

describe('window.llp', () => {
  it('accepts the existing slides bridge argument and additive preload bridges', () => {
    const {port} = recordingPort();
    const original = llpApi(port, PLATFORM);
    expect(llpApi(port, PLATFORM, original.slidesEditor).slidesEditor).toBe(
      original.slidesEditor,
    );
    const custom = llpApi(port, PLATFORM, {
      bible: original.bible,
      slidesEditor: original.slidesEditor,
    });
    expect(custom.bible).toBe(original.bible);
    expect(custom.slidesEditor).toBe(original.slidesEditor);
  });
  it('exposes every declared endpoint through exactly one member', () => {
    const {port, used} = recordingPort();
    llpApi(port, PLATFORM);
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(DECLARED));
  });

  it('makes every member a function', () => {
    const api = llpApi(recordingPort().port, PLATFORM);
    const parts: unknown[] = Object.values(api);
    for (const part of parts) {
      const members: unknown[] =
        typeof part === 'object' && part !== null ? Object.values(part) : [];
      expect(members.length).toBeGreaterThan(0);
      for (const member of members) expect(member).toBeTypeOf('function');
    }
  });
});
