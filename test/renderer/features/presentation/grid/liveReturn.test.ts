import {afterEach, describe, expect, it, vi} from 'vitest';
import {liveReturn} from '@renderer/features/presentation/grid/liveReturn';

afterEach(() => liveReturn.offer(null));

describe('현 위치로 state', () => {
  it('is none without a continuous view and ignores reports then', () => {
    expect(liveReturn.get()).toBe('none');
    liveReturn.report(true);
    expect(liveReturn.get()).toBe('none');
  });

  it('turns away when the live slide leaves the view and here when it returns', () => {
    const listener = vi.fn();
    const stop = liveReturn.subscribe(listener);
    liveReturn.offer(() => undefined);
    expect(liveReturn.get()).toBe('here');
    liveReturn.report(true);
    expect(liveReturn.get()).toBe('away');
    liveReturn.report(true);
    liveReturn.report(false);
    expect(liveReturn.get()).toBe('here');
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });

  it('runs the way back the view offered and forgets it when the view leaves', () => {
    const back = vi.fn();
    liveReturn.offer(back);
    liveReturn.go();
    expect(back).toHaveBeenCalledOnce();
    liveReturn.offer(null);
    liveReturn.go();
    expect(back).toHaveBeenCalledOnce();
    expect(liveReturn.get()).toBe('none');
  });
});
