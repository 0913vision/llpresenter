import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {DISPLAY_RETRY_MS, DISPLAY_SETTLE_MS, DisplayRegistry} from './registry';
import {FakeDisplaySource, displayInfo, recordingLogger} from './testing';

const control = displayInfo({id: 1, primary: true});
const projector = displayInfo({id: 2, x: 1920});

describe('DisplayRegistry', () => {
  it('reports removal immediately, isolates listener failures, and releases both subscriptions', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    const removed = vi.fn();
    const settled = vi.fn();
    registry.subscribeRemoved(() => {
      throw new Error('removal listener failed');
    });
    const stop = registry.subscribeRemoved(removed);
    registry.subscribe(settled);

    source.remove(projector.id);

    expect(removed).toHaveBeenCalledExactlyOnceWith(projector.id);
    expect(settled).not.toHaveBeenCalled();
    expect(registry.monitors).toHaveLength(2);
    expect(log.messages('error')).toEqual([
      'a monitor removal listener failed',
    ]);
    await clock.advance(DISPLAY_SETTLE_MS);
    expect(settled).toHaveBeenCalledTimes(1);
    stop();
    source.emit({kind: 'removed', id: control.id});
    expect(removed).toHaveBeenCalledTimes(1);
    registry.dispose();
    await clock.runAll();
    expect(settled).toHaveBeenCalledTimes(1);
    expect(registry.listenerCount).toBe(0);
    expect(source.watcherCount).toBe(0);
  });

  it('reads the numbered monitors at start', () => {
    const registry = new DisplayRegistry(
      new FakeDisplaySource(projector, control),
      recordingLogger(),
    );
    expect(registry.monitors.map(({id, number}) => [id, number])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('reads again once a burst of display events settles', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const registry = new DisplayRegistry(source, recordingLogger());
    const listener = vi.fn();
    registry.subscribe(listener);

    source.change(control);
    await clock.advance(DISPLAY_SETTLE_MS - 1);
    source.emit();
    await clock.advance(DISPLAY_SETTLE_MS - 1);
    expect(listener).not.toHaveBeenCalled();
    await clock.advance(1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.monitors.map(({id}) => id)).toEqual([1]);
  });

  it('stays quiet when a display event changes nothing', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const registry = new DisplayRegistry(source, recordingLogger());
    const listener = vi.fn();
    registry.subscribe(listener);
    source.emit();
    await clock.advance(DISPLAY_SETTLE_MS);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads at once on refresh and drops the pending read', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const registry = new DisplayRegistry(source, recordingLogger());
    const listener = vi.fn();
    registry.subscribe(listener);
    source.change(control);
    registry.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    await clock.advance(DISPLAY_SETTLE_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the last list when the system reports no monitors', () => {
    installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    source.displays = [];
    registry.refresh();
    expect(registry.monitors).toHaveLength(2);
    expect(log.messages('warn')).toHaveLength(1);
  });

  it('logs a failed read and keeps the last list', () => {
    installFakeClock();
    const source = new FakeDisplaySource(control);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    source.failure = new Error('display service down');
    registry.refresh();
    expect(registry.monitors).toHaveLength(1);
    expect(log.messages('error')).toEqual(['could not read the monitors']);
  });

  it('reads again by itself after an empty read until the system recovers', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control, projector);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    const listener = vi.fn();
    registry.subscribe(listener);
    source.displays = [];
    registry.refresh();
    await clock.advance(DISPLAY_RETRY_MS * 3);
    expect(listener).not.toHaveBeenCalled();

    source.displays = [control];
    await clock.advance(DISPLAY_RETRY_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.monitors.map(({id}) => id)).toEqual([1]);
    expect(log.messages('warn')).toHaveLength(1);
    expect(log.messages('info')).toContain('the monitors can be read again');
  });

  it('recovers from a failed read at start without a display event', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control);
    source.failure = new Error('display service starting');
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    expect(registry.monitors).toEqual([]);
    source.failure = null;
    await clock.advance(DISPLAY_RETRY_MS);
    expect(registry.monitors).toHaveLength(1);
    expect(log.messages('error')).toEqual(['could not read the monitors']);
  });

  it('cancels a pending retry on dispose', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control);
    const registry = new DisplayRegistry(source, recordingLogger());
    source.displays = [];
    registry.refresh();
    const read = vi.spyOn(source, 'read');
    registry.dispose();
    await clock.runAll();
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps notifying the other listeners when one throws', () => {
    const source = new FakeDisplaySource(control);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    const after = vi.fn();
    registry.subscribe(() => {
      throw new Error('listener failed');
    });
    registry.subscribe(after);
    source.displays = [control, projector];
    registry.refresh();
    expect(after).toHaveBeenCalledTimes(1);
    expect(log.messages('error')).toEqual(['a monitor listener failed']);
  });

  it('releases its watcher, its timer, and its listeners on dispose', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(control);
    const registry = new DisplayRegistry(source, recordingLogger());
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    unsubscribe();
    registry.subscribe(listener);
    source.change(control, projector);
    registry.dispose();
    await clock.runAll();
    expect(listener).not.toHaveBeenCalled();
    expect(source.watcherCount).toBe(0);
    expect(registry.listenerCount).toBe(0);
  });
});
