import {createPacer} from '../../../src/main/ndi/pacer.cjs';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it, vi} from 'vitest';

describe('GPU NDI utility', () => {
  it('probes shared textures without opening a second NDI sender or repeating frames', () => {
    vi.useFakeTimers();
    const port = new EventEmitter();
    const postMessage = vi.fn<(message: {type: string}) => void>();
    Object.assign(port, {postMessage});
    const openReal = vi.fn();
    const source = readFileSync(
      new URL('../../../src/main/ndi/gpu-utility.cjs', import.meta.url),
      'utf8',
    );
    const mockedRequire = (name: string): unknown => {
      switch (name) {
        case './d3d.cjs':
          return {
            create: () => ({
              read: (
                ...[, , dirty, consume]: [
                  number,
                  string,
                  object,
                  (value: object) => void,
                ]
              ) => consume({bytes: Buffer.alloc(4), format: 87, dirty}),
              close: vi.fn(),
            }),
          };
        case './ndi-library.cjs':
          return {openReal, frameRate: () => ({n: 30, d: 1})};
        case './pacer.cjs':
          return {createPacer};
        case './dirty.cjs':
          return {applyDirty: vi.fn()};
        case 'node:buffer':
          return {Buffer};
        case 'node:process':
          return {env: {LLP_NDI_PROBE: '1'}, parentPort: port, exit: vi.fn()};
        case 'koffi':
          return {};
        default:
          throw new Error(`Unexpected import ${name}`);
      }
    };
    runInNewContext(source, {require: mockedRequire, Buffer});
    port.emit('message', {
      data: {
        type: 'frame',
        pid: 1,
        handle: '01',
        dirty: {x: 0, y: 0, width: 1, height: 1},
      },
    });
    expect(openReal).not.toHaveBeenCalled();
    expect(
      postMessage.mock.calls.filter(([message]) => message.type === 'pixels'),
    ).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(
      postMessage.mock.calls.filter(([message]) => message.type === 'pixels'),
    ).toHaveLength(1);
    port.emit('message', {data: {type: 'stop'}});
    vi.useRealTimers();
  });
  it('copies using the fake native reader, acknowledges, and sends one persistent frame', () => {
    vi.useFakeTimers();
    const port = new EventEmitter();
    const postMessage = vi.fn<(message: {type: string}) => void>();
    Object.assign(port, {postMessage});
    interface Dirty {
      x: number;
      y: number;
      width: number;
      height: number;
    }
    type Consume = (value: {
      bytes: Buffer;
      format: number;
      dirty: Dirty;
    }) => void;
    const read = vi.fn(
      (...[, , dirty, consume]: [number, string, Dirty, Consume]) => {
        consume({bytes: Buffer.alloc(4), format: 87, dirty});
      },
    );
    const closeReader = vi.fn();
    const send = vi.fn();
    const sync = vi.fn();
    const close = vi.fn();
    const applyDirty = vi.fn();
    const source = readFileSync(
      new URL('../../../src/main/ndi/gpu-utility.cjs', import.meta.url),
      'utf8',
    );
    const mockedRequire = (name: string): unknown => {
      switch (name) {
        case './d3d.cjs':
          return {create: () => ({read, close: closeReader})};
        case './ndi-library.cjs':
          return {
            openReal: () => ({send, sync, close}),
            frameRate: () => ({n: 30, d: 1}),
          };
        case './pacer.cjs':
          return {createPacer};
        case './dirty.cjs':
          return {applyDirty};
        case 'node:buffer':
          return {Buffer};
        case 'node:process':
          return {parentPort: port, exit: vi.fn()};
        case 'koffi':
          return {};
        default:
          throw new Error(`Unexpected import ${name}`);
      }
    };
    runInNewContext(source, {require: mockedRequire, Buffer});
    const msg = {
      type: 'frame',
      pid: 1,
      handle: '01',
      dirty: {x: 0, y: 0, width: 1, height: 1},
    };
    port.emit('message', {data: msg});
    port.emit('message', {data: msg});
    expect(sync).toHaveBeenCalledOnce();
    expect(applyDirty).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBe(send.mock.calls[1]?.[0]);
    const copied = postMessage.mock.calls.findIndex(
      ([m]) => m.type === 'copied',
    );
    expect(postMessage.mock.invocationCallOrder[copied]).toBeLessThan(
      send.mock.invocationCallOrder[0] ?? 0,
    );
    const live = postMessage.mock.calls.findIndex(([m]) => m.type === 'live');
    expect(postMessage.mock.invocationCallOrder[live]).toBeGreaterThan(
      send.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      postMessage.mock.calls.filter(([m]) => m.type === 'live'),
    ).toHaveLength(1);
    vi.advanceTimersByTime(34);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1]?.[0]).toBe(send.mock.calls[2]?.[0]);
    port.emit('message', {data: {type: 'stop'}});
    expect(closeReader).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
