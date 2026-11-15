import {describe, expect, it, vi} from 'vitest';
import {GraphicsRecovery} from '@main/windows/graphicsRecovery';

describe('graphics recovery coordination', () => {
  it('coalesces simultaneous failures and retains a GPU loss during control recovery', async () => {
    let finish: (() => void) | undefined;
    const recover = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const failed = vi.fn();
    const recovery = new GraphicsRecovery(recover, failed);
    recovery.request('control-hang');
    recovery.request('control-hang');
    recovery.request('gpu-loss');
    recovery.request('gpu-loss');
    expect(recover).toHaveBeenCalledTimes(1);
    finish?.();
    await vi.waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
    expect(recover).toHaveBeenLastCalledWith('gpu-loss');
    recovery.stop();
    finish?.();
    await Promise.resolve();
    expect(failed).not.toHaveBeenCalled();
  });

  it('reports recovery errors and does not restart after it stops', async () => {
    const failed = vi.fn();
    const recover = vi.fn().mockRejectedValue(new Error('failed'));
    const recovery = new GraphicsRecovery(recover, failed);
    recovery.request('gpu-loss');
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
    recovery.stop();
    recovery.request('control-hang');
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
