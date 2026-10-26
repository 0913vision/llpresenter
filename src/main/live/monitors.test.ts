import {describe, expect, it, vi} from 'vitest';
import {LiveStore} from './store';

describe('monitors.identify', () => {
  it('shows the monitor numbers after the dispatch without changing the state', () => {
    const store = new LiveStore();
    const port = {identify: vi.fn()};
    const release = store.connectMonitorNumbers(port);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.dispatch({type: 'monitors.identify'})).toBe(false);
    expect(port.identify).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
    release();
    const skipped = vi.fn();
    store.dispatch({type: 'monitors.identify'}, undefined, skipped);
    expect(port.identify).toHaveBeenCalledOnce();
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({type: 'monitors.identify', reason: 'failed'}),
    );
  });

  it('keeps a newer connection when an older one is released', () => {
    const store = new LiveStore();
    const older = {identify: vi.fn()};
    const newer = {identify: vi.fn()};
    const releaseOlder = store.connectMonitorNumbers(older);
    store.connectMonitorNumbers(newer);
    releaseOlder();
    store.dispatch({type: 'monitors.identify'});
    expect(newer.identify).toHaveBeenCalledOnce();
    expect(older.identify).not.toHaveBeenCalled();
  });
});
