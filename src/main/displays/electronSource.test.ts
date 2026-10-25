import {expect, it, vi} from 'vitest';
import {createElectronDisplaySource} from './electronSource';

const screen = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  return new EventEmitter();
});
vi.mock('electron', () => ({screen}));

it('forwards the removed display id synchronously and releases all Electron listeners', () => {
  const listener = vi.fn();
  const stop = createElectronDisplaySource().watch(listener);
  screen.emit('display-removed', {}, {id: 22});
  expect(listener).toHaveBeenCalledExactlyOnceWith({kind: 'removed', id: 22});
  screen.emit('display-added', {}, {id: 44});
  screen.emit('display-metrics-changed', {}, {id: 44}, ['bounds']);
  expect(listener.mock.calls.slice(1)).toEqual([
    [{kind: 'changed'}],
    [{kind: 'changed'}],
  ]);

  stop();
  expect(screen.eventNames()).toEqual([]);
  screen.emit('display-removed', {}, {id: 44});
  expect(listener).toHaveBeenCalledTimes(3);
});
