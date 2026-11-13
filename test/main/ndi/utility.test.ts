import {createPacer} from '../../../src/main/ndi/pacer.cjs';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it, vi} from 'vitest';

describe('NDI utility sender', () => {
  it('applies dirty pixels to one retained frame and synchronizes before modifying it', () => {
    vi.useFakeTimers();
    const port = new EventEmitter();
    const postMessage = vi.fn();
    Object.assign(port, {postMessage});
    const send = vi.fn();
    const sync = vi.fn();
    const close = vi.fn();
    const applyDirty = vi.fn();
    const source = readFileSync(
      new URL('../../../src/main/ndi/utility.cjs', import.meta.url),
      'utf8',
    );
    const mockedRequire = (name: string): unknown => {
      switch (name) {
        case './ndi-library.cjs':
          return {openReal: () => ({send, sync, close})};
        case './pacer.cjs':
          return {createPacer};
        case './dirty.cjs':
          return {applyDirty};
        case 'node:process':
          return {parentPort: port, exit: vi.fn()};
        case 'node:buffer':
          return {Buffer};
        case 'node:timers':
          return {setInterval, clearInterval};
        case 'koffi':
          return {};
        default:
          throw new Error(`Unexpected import ${name}`);
      }
    };
    runInNewContext(source, {require: mockedRequire});
    const first = {x: 0, y: 0, width: 1, height: 1, data: Buffer.alloc(4)};
    const second = {...first, x: 1};
    port.emit('message', {data: {type: 'frame', data: first}});
    port.emit('message', {data: {type: 'frame', data: second}});

    expect(applyDirty).toHaveBeenCalledTimes(2);
    expect(sync).toHaveBeenCalledOnce();
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
      applyDirty.mock.invocationCallOrder[1] ?? 0,
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBe(send.mock.calls[1]?.[0]);
    vi.advanceTimersByTime(34);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1]?.[0]).toBe(send.mock.calls[2]?.[0]);
    vi.advanceTimersByTime(966);
    expect(postMessage).toHaveBeenCalledWith({type: 'heartbeat'});
    expect(postMessage).toHaveBeenCalledTimes(5);
    port.emit('message', {data: {type: 'stop'}});
    expect(close).toHaveBeenCalledOnce();
    const count = postMessage.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(count);
    vi.useRealTimers();
    expect(postMessage).toHaveBeenCalledWith({type: 'ready'});
  });
});
