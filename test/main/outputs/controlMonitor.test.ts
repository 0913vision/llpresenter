import {EventEmitter} from 'node:events';
import {expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {watchControlMonitor} from '@main/outputs/controlMonitor';

it('coalesces bounds events, follows topology updates, and releases pending work', async () => {
  const clock = installMockClock();
  const control = new EventEmitter();
  const topology = new EventEmitter();
  let id = 1;
  const changed = vi.fn();
  const stop = watchControlMonitor({
    control,
    monitorId: () => id,
    changed,
    displays: {
      subscribe: listener => {
        topology.on('changed', listener);
        return () => {
          topology.removeListener('changed', listener);
        };
      },
    },
  });
  control.emit('move');
  await clock.advance(0);
  expect(changed).not.toHaveBeenCalled();
  id = 2;
  control.emit('move');
  control.emit('resize');
  await clock.advance(0);
  expect(changed).toHaveBeenCalledTimes(1);
  id = 3;
  topology.emit('changed');
  id = 2;
  control.emit('move');
  await clock.advance(0);
  expect(changed).toHaveBeenCalledTimes(2);
  id = 1;
  control.emit('move');
  stop();
  await clock.advance(0);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(control.eventNames()).toEqual([]);
  expect(topology.eventNames()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});
