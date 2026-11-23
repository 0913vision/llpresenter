import {describe, expect, it} from 'vitest';
import {llpApi} from '@contracts/ipc/api';
import type {IpcPort, WindowPlatform} from '@contracts/ipc/endpoint';

/** Every file of the contracts, so a new area is checked without a list. */
const AREAS = import.meta.glob<Record<string, unknown>>(
  '/src/contracts/ipc/*.ts',
  {eager: true},
);

function endpointsIn(table: object): object[] {
  return Object.values(table).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    return 'channel' in entry ? [entry] : endpointsIn(entry);
  });
}

const DECLARED = Object.values(AREAS)
  .flatMap(area =>
    Object.entries(area).flatMap(([name, value]) =>
      name.endsWith('Endpoints') && typeof value === 'object' && value !== null
        ? [value]
        : [],
    ),
  )
  .flatMap(endpointsIn);

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
  it('takes the bridges the preload adds', () => {
    const {port} = recordingPort();
    const original = llpApi(port, PLATFORM);
    const custom = llpApi(port, PLATFORM, {bible: original.bible});
    expect(custom.bible).toBe(original.bible);
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
