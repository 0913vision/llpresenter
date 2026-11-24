import {describe, expect, it, vi} from 'vitest';
import {bibleEndpoints} from '@contracts/ipc/bible';
import {biblePreload} from '../../src/preload/bible';
import {createIpcPort, type IpcRendererPort} from '../../src/preload/port';

describe('Bible AI preload contract', () => {
  it('checks chooser requests, returned indices, cancellation and both status paths', async () => {
    const listeners = new Map<
      string,
      (event: unknown, ...args: unknown[]) => void
    >();
    const ipc = {
      invoke:
        vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
      send: vi.fn(),
      on: (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => void,
      ) => listeners.set(channel, listener),
      removeListener: (channel: string) => listeners.delete(channel),
    } satisfies IpcRendererPort;
    const log = vi.fn();
    const api = biblePreload(createIpcPort(ipc, log));
    const request = {
      lookupId: 'lookup-1',
      fullText: 'one two',
      remaining: 'one two',
      candidates: ['one', 'one two'],
    };
    ipc.invoke.mockResolvedValueOnce(1);
    expect(await api.chooseBoundary(request)).toBe(1);
    expect(ipc.invoke).toHaveBeenLastCalledWith(
      bibleEndpoints.chooseBoundary.channel,
      request,
    );
    ipc.invoke.mockResolvedValueOnce(2);
    await expect(api.chooseBoundary(request)).rejects.toThrow('Bad reply');
    await expect(
      api.chooseBoundary({...request, candidates: []}),
    ).rejects.toThrow('Bad request');
    expect(ipc.invoke).toHaveBeenCalledTimes(2);
    ipc.invoke.mockResolvedValueOnce(true);
    expect(await api.cancelBoundary({lookupId: request.lookupId})).toBe(true);
    ipc.invoke.mockResolvedValueOnce('true');
    await expect(
      api.cancelBoundary({lookupId: request.lookupId}),
    ).rejects.toThrow('Bad reply');
    const state = {status: 'ready', available: true, reason: ''};
    ipc.invoke.mockResolvedValueOnce(state);
    expect(await api.getLlmStatus()).toEqual(state);
    const listener = vi.fn();
    const stop = api.onLlmStatus(listener);
    listeners.get(bibleEndpoints.llmStatusChanged.channel)?.(
      {},
      {...state, available: false},
    );
    expect(listener).not.toHaveBeenCalled();
    listeners.get(bibleEndpoints.llmStatusChanged.channel)?.({}, state);
    expect(listener).toHaveBeenCalledExactlyOnceWith(state);
    stop();
    expect(listeners.size).toBe(0);
    expect(log).toHaveBeenCalledTimes(4);
  });
});
