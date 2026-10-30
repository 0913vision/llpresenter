import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../../test/fake-clock';
import {APP_FLUSH_LIMITS, type AppFlushRequest} from '@core/schema/appFlush';
import {createAppFlushRequestId} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {CloseFlush, SAVING_DIALOG_DELAY_MS} from './closeFlush';

const requestId = createAppFlushRequestId(
  'b52f1d63-8f20-4b3c-9d4e-5f6071829304',
);

function deferred(): {
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
} {
  let resolve: (value: boolean) => void = () => undefined;
  const promise = new Promise<boolean>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

function setup(flush: () => Promise<boolean>) {
  const listeners = new Set<(request: AppFlushRequest) => void>();
  const flushDone = vi.fn();
  const flushProgress = vi.fn();
  const closeAnyway = vi.fn();
  const control = vi.fn();
  const write = vi.fn();
  const api = fakeLlpApi({
    app: {
      subscribeFlushRequests: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      flushDone,
      flushProgress,
      closeAnyway,
    },
    window: {control},
    log: {write},
  });
  const model = new CloseFlush({api, flush});
  onTestFinished(() => {
    model.dispose();
  });
  const changed = vi.fn();
  model.subscribe(changed);
  const request = () => {
    for (const listener of listeners) listener({requestId});
  };
  return {
    model,
    listeners,
    flushDone,
    flushProgress,
    closeAnyway,
    control,
    write,
    request,
  };
}

describe('close flush', () => {
  it('reports progress while waiting for disk beyond the renderer timeout and stops after a refusal', async () => {
    const clock = installFakeClock();
    const pending = deferred();
    const {model, flushProgress, request} = setup(() => pending.promise);
    request();
    expect(flushProgress).toHaveBeenCalledExactlyOnceWith({requestId});
    await clock.advance(APP_FLUSH_LIMITS.timeoutMs * 2);
    expect(flushProgress).toHaveBeenCalledTimes(
      1 +
        (APP_FLUSH_LIMITS.timeoutMs * 2) / APP_FLUSH_LIMITS.progressIntervalMs,
    );
    expect(model.getSnapshot()).toBe('saving');
    pending.resolve(false);
    await clock.advance(0);
    expect(model.getSnapshot()).toBe('failed');
    const progressCount = flushProgress.mock.calls.length;
    await clock.advance(APP_FLUSH_LIMITS.timeoutMs);
    expect(flushProgress).toHaveBeenCalledTimes(progressCount);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never shows the dialog when the flush ends before the delay', async () => {
    const clock = installFakeClock();
    const {model, flushDone, request} = setup(() => Promise.resolve(true));
    request();
    await clock.advance(SAVING_DIALOG_DELAY_MS);
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: true,
    });
    expect(model.getSnapshot()).toBe('hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows 저장 중 after the delay and keeps it until the window closes', async () => {
    const clock = installFakeClock();
    const pending = deferred();
    const {model, flushDone, request} = setup(() => pending.promise);
    request();
    await clock.advance(SAVING_DIALOG_DELAY_MS - 1);
    expect(model.getSnapshot()).toBe('hidden');
    await clock.advance(1);
    expect(model.getSnapshot()).toBe('saving');
    pending.resolve(true);
    await clock.runAll();
    expect(flushDone).toHaveBeenCalledWith({requestId, result: true});
    expect(model.getSnapshot()).toBe('saving');
  });

  it('shows the refusal at once and asks main again on 다시 시도', async () => {
    const answers = [false, true];
    const {model, flushDone, control, request} = setup(() =>
      Promise.resolve(answers.shift() ?? true),
    );
    request();
    await vi.waitFor(() => expect(model.getSnapshot()).toBe('failed'));
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: false,
    });
    model.retry();
    expect(model.getSnapshot()).toBe('saving');
    expect(control).toHaveBeenCalledExactlyOnceWith('close');
    request();
    await vi.waitFor(() => expect(flushDone).toHaveBeenCalledTimes(2));
    expect(flushDone).toHaveBeenLastCalledWith({requestId, result: true});
    expect(model.getSnapshot()).toBe('saving');
  });

  it('logs a failing flush and answers it as refused', async () => {
    const {model, flushDone, write, request} = setup(() =>
      Promise.reject(new Error('Invented flush failure')),
    );
    request();
    await vi.waitFor(() => expect(model.getSnapshot()).toBe('failed'));
    expect(flushDone).toHaveBeenCalledWith({requestId, result: false});
    expect(write).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        level: 'error',
        message: 'could not flush the editor before closing',
      }),
    );
  });

  it('asks main to close without the flush on 강제로 닫기', () => {
    const {model, closeAnyway} = setup(() => Promise.resolve(false));
    model.forceClose();
    expect(closeAnyway).toHaveBeenCalledOnce();
  });

  it('stops answering and drops its timer on dispose', () => {
    installFakeClock();
    const {model, listeners, request} = setup(
      () => new Promise(() => undefined),
    );
    request();
    expect(vi.getTimerCount()).toBe(2);
    model.dispose();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(model.getSnapshot()).toBe('hidden');
  });
});
