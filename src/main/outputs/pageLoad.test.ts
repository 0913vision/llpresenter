import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../../test/mock-clock';
import {DRAW_LIMIT_MS, PageLoad, type LoadFailure} from './pageLoad';

const LOAD_ERROR = new Error('ERR_FAILED');

function deferredLoad(): {
  promise: Promise<void>;
  reject: (error: unknown) => void;
} {
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((_resolve, fail) => {
    reject = fail;
  });
  return {promise, reject};
}

describe('PageLoad', () => {
  it('fails once when the load is rejected', async () => {
    const clock = installMockClock();
    const failures: LoadFailure[] = [];
    const loading = deferredLoad();
    const load = new PageLoad(loading.promise, failure =>
      failures.push(failure),
    );
    load.startDrawLimit();
    loading.reject(LOAD_ERROR);
    await clock.advance(0);
    expect(failures).toEqual([{kind: 'rejected', error: LOAD_ERROR}]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails once when the page misses its draw limit', async () => {
    const clock = installMockClock();
    const onFailed = vi.fn();
    const load = new PageLoad(Promise.resolve(), onFailed);
    load.startDrawLimit();
    await clock.advance(DRAW_LIMIT_MS - 1);
    expect(onFailed).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(onFailed).toHaveBeenCalledWith({kind: 'not-drawn'});
  });

  it('ignores a rejection after it missed its draw limit', async () => {
    const clock = installMockClock();
    const onFailed = vi.fn();
    const loading = deferredLoad();
    const load = new PageLoad(loading.promise, onFailed);
    load.startDrawLimit();
    await clock.advance(DRAW_LIMIT_MS);
    loading.reject(LOAD_ERROR);
    await clock.advance(0);
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('hears nothing once settled', async () => {
    const clock = installMockClock();
    const onFailed = vi.fn();
    const loading = deferredLoad();
    const load = new PageLoad(loading.promise, onFailed);
    load.startDrawLimit();
    load.settle();
    load.startDrawLimit();
    loading.reject(LOAD_ERROR);
    await clock.advance(DRAW_LIMIT_MS * 2);
    expect(onFailed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits without a limit while stopped and gets the full limit again', async () => {
    const clock = installMockClock();
    const onFailed = vi.fn();
    const load = new PageLoad(Promise.resolve(), onFailed);
    load.startDrawLimit();
    await clock.advance(DRAW_LIMIT_MS - 1);
    load.stopDrawLimit();
    await clock.advance(DRAW_LIMIT_MS * 3);
    load.startDrawLimit();
    await clock.advance(DRAW_LIMIT_MS - 1);
    expect(onFailed).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
  });
});
