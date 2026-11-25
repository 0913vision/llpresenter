import type {EventEmitter} from 'node:events';
import {afterEach, expect, it, vi} from 'vitest';

interface Child {
  readonly emitter: EventEmitter;
  readonly posted: Array<Record<string, unknown>>;
  killed: boolean;
}

const children = vi.hoisted((): Child[] => []);

vi.mock('electron', async () => {
  const {EventEmitter: Emitter} = await import('node:events');
  return {
    utilityProcess: {
      fork: () => {
        const emitter = new Emitter();
        const child: Child = {emitter, posted: [], killed: false};
        children.push(child);
        return Object.assign(emitter, {
          postMessage: (message: Record<string, unknown>) => {
            child.posted.push(message);
          },
          kill: () => {
            child.killed = true;
          },
        });
      },
    },
  };
});

const {PresenterProcess} =
  await import('@main/outputs/presenter/presenterProcess');

afterEach(() => {
  children.length = 0;
  vi.useRealTimers();
});

function setup() {
  const events = {message: vi.fn(), exited: vi.fn(), failed: vi.fn()};
  return {process: new PresenterProcess(events), events};
}

it('keeps messages until the process has spawned, then sends them in order', () => {
  const {process} = setup();
  expect(process.start()).toBe(true);
  process.post({type: 'open'});
  process.post({type: 'show'});
  const child = children[0];
  expect(child?.posted).toEqual([]);

  child?.emitter.emit('spawn');

  expect(child?.posted).toEqual([{type: 'open'}, {type: 'show'}]);
  expect(process.running).toBe(true);
});

it('hands on its messages and tells when it ended by itself', () => {
  const {process, events} = setup();
  process.start();
  const child = children[0];
  child?.emitter.emit('message', {type: 'ready'});
  child?.emitter.emit('exit', 3);

  expect(events.message).toHaveBeenCalledWith({type: 'ready'});
  expect(events.exited).toHaveBeenCalledWith(3);
  expect(process.running).toBe(false);
});

it('asks a stopped process to stop, ends it after a grace time, and tells nothing more', () => {
  vi.useFakeTimers();
  const {process, events} = setup();
  process.start();
  const child = children[0];
  child?.emitter.emit('spawn');

  process.stop();
  child?.emitter.emit('message', {type: 'copied', id: 1});
  child?.emitter.emit('exit', 0);

  expect(child?.posted.at(-1)).toEqual({type: 'stop'});
  expect(events.message).not.toHaveBeenCalled();
  expect(events.exited).not.toHaveBeenCalled();
  expect(child?.killed).toBe(false);
  vi.advanceTimersByTime(2000);
  expect(child?.killed).toBe(true);
});
