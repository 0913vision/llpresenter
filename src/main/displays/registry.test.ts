import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import type {DisplayInfo} from './monitor';
import {
  DISPLAY_SETTLE_MS,
  DisplayRegistry,
  type DisplaySource,
} from './registry';
import {displayInfo, recordingLogger} from './testing';

class FakeDisplaySource implements DisplaySource {
  displays: readonly DisplayInfo[];
  failure: Error | null = null;
  private readonly watchers = new Set<() => void>();

  constructor(...displays: readonly DisplayInfo[]) {
    this.displays = displays;
  }

  get watcherCount(): number {
    return this.watchers.size;
  }

  read(): readonly DisplayInfo[] {
    if (this.failure !== null) throw this.failure;
    return this.displays;
  }

  watch(listener: () => void): () => void {
    this.watchers.add(listener);
    return () => {
      this.watchers.delete(listener);
    };
  }

  /** Changes the monitors and fires one display event. */
  change(...displays: readonly DisplayInfo[]): void {
    this.displays = displays;
    this.emit();
  }

  emit(): void {
    for (const watcher of this.watchers) watcher();
  }
}

const control = displayInfo({id: 1, primary: true});
const projector = displayInfo({id: 2, x: 1920});

describe('DisplayRegistry', () => {
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
    const source = new FakeDisplaySource(control, projector);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    source.displays = [];
    registry.refresh();
    expect(registry.monitors).toHaveLength(2);
    expect(log.messages('warn')).toHaveLength(1);
  });

  it('logs a failed read and keeps the last list', () => {
    const source = new FakeDisplaySource(control);
    const log = recordingLogger();
    const registry = new DisplayRegistry(source, log);
    source.failure = new Error('display service down');
    registry.refresh();
    expect(registry.monitors).toHaveLength(1);
    expect(log.messages('error')).toEqual(['could not read the monitors']);
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
