import {describe, expect, it} from 'vitest';
import {llpApi} from './api';
import {appEndpoints} from './app';
import {bibleEndpoints} from './bible';
import {contentEndpoints} from './content';
import type {IpcPort, WindowPlatform} from './endpoint';
import {libraryEndpoints} from './library';
import {liveEndpoints} from './live';
import {mediaEndpoints} from './media';
import {outputEndpoints} from './output';
import {recoveryEndpoints} from './recovery';
import {serviceEndpoints} from './service';
import {settingsEndpoints} from './settings';
import {uiEndpoints} from './ui';
import {windowEndpoints} from './window';

function endpointsIn(table: object): object[] {
  return Object.values(table).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    return 'channel' in entry ? [entry] : endpointsIn(entry);
  });
}

const DECLARED = [
  appEndpoints,
  bibleEndpoints,
  contentEndpoints,
  libraryEndpoints,
  liveEndpoints,
  mediaEndpoints,
  recoveryEndpoints,
  serviceEndpoints,
  settingsEndpoints,
  uiEndpoints,
  windowEndpoints,
  outputEndpoints,
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
