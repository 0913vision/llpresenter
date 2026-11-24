import {describe, expect, it, vi} from 'vitest';
import {updatePreload} from '../../src/preload/update';
import {createIpcPort, type IpcRendererPort} from '../../src/preload/port';

describe('update preload', () => {
  it('validates actions, snapshots and pushes and releases its listener', async () => {
    const listeners = new Map<
      string,
      (event: unknown, ...args: unknown[]) => void
    >();
    const ipc = {
      invoke: vi.fn<(channel: string) => Promise<unknown>>(),
      send: vi.fn(),
      on: (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => void,
      ) => listeners.set(channel, listener),
      removeListener: (channel: string) => listeners.delete(channel),
    } satisfies IpcRendererPort;
    const log = vi.fn();
    const api = updatePreload(createIpcPort(ipc, log));
    const snapshot = {
      revision: 1,
      status: {kind: 'idle'},
      visible: false,
      outputsOn: false,
      busy: false,
    };
    ipc.invoke.mockResolvedValue(snapshot);
    expect(await api.get()).toEqual(snapshot);
    ipc.invoke.mockResolvedValue({...snapshot, revision: -1});
    await expect(api.get()).rejects.toThrow('Bad reply');
    api.act({revision: -1, action: 'install'});
    expect(ipc.send).not.toHaveBeenCalled();
    api.act({revision: 1, action: 'later'});
    api.check();
    expect(ipc.send.mock.calls).toEqual([
      ['update:act', {revision: 1, action: 'later'}],
      ['update:check'],
    ]);
    const receive = vi.fn();
    const stop = api.subscribe(receive);
    listeners.get('update:changed')?.(
      {},
      {...snapshot, status: {kind: 'downloaded'}},
    );
    expect(receive).not.toHaveBeenCalled();
    listeners.get('update:changed')?.({}, snapshot);
    expect(receive).toHaveBeenCalledExactlyOnceWith(snapshot);
    stop();
    expect(listeners.size).toBe(0);
  });
});
