import {EventEmitter} from 'node:events';
import {afterEach, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {stopSender, type StoppableSender} from '@main/outputs/ndi/ndiWindow';

vi.mock('electron', () => ({BrowserWindow: vi.fn()}));

afterEach(() => {
  vi.useRealTimers();
});

/** A sender process that records what it is asked, and exits when killed. */
function sender({postFails = false} = {}) {
  const emitter = new EventEmitter();
  const posted: unknown[] = [];
  const kill = vi.fn(() => {
    emitter.emit('exit', 1);
    return true;
  });
  const process: StoppableSender = {
    kill,
    postMessage: (message: unknown) => {
      if (postFails) throw new Error('process is gone');
      posted.push(message);
    },
    once: (event, listener) => emitter.once(event, listener),
  };
  return {process, posted, kill, emitter};
}

it('asks the sender to stop, and ends it when it has not exited in time', () => {
  vi.useFakeTimers();
  const {process, posted, kill} = sender();
  const exited = vi.fn();
  stopSender(process, {timeoutMs: 2000, exited});
  expect(posted).toEqual([{type: 'stop'}]);
  vi.advanceTimersByTime(1999);
  expect(kill).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(kill).toHaveBeenCalledOnce();
  expect(exited).toHaveBeenCalledOnce();
});

it('leaves a sender that exits by itself alone', () => {
  vi.useFakeTimers();
  const {process, kill, emitter} = sender();
  const exited = vi.fn();
  stopSender(process, {timeoutMs: 2000, exited});
  emitter.emit('exit', 0);
  vi.advanceTimersByTime(5000);
  expect(kill).not.toHaveBeenCalled();
  expect(exited).toHaveBeenCalledOnce();
});

it('ends the sender at once when asked to, or when it can no longer be asked', () => {
  const now = sender();
  stopSender(now.process, {timeoutMs: 2000, now: true});
  expect(now.posted).toEqual([]);
  expect(now.kill).toHaveBeenCalledOnce();

  const gone = sender({postFails: true});
  const log = recordingLogger();
  stopSender(gone.process, {timeoutMs: 2000, log});
  expect(gone.kill).toHaveBeenCalledOnce();
  expect(log.entries).toContainEqual(
    expect.objectContaining({
      level: 'warn',
      message: 'NDI sender already stopped',
    }),
  );
});
