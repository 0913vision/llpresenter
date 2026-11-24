import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/app/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  useSettingsDocument,
  useApiSettingsDocument,
} from '@renderer/platform/documents/useSettingsDocument';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

afterEach(() => {
  delete window.llp;
});

describe('useSettingsDocument', () => {
  it('reports a reply for a different settings file as a failed read', async () => {
    const onProblem = vi.fn();
    window.llp = mockLlpApi({
      settings: {
        get: async () => settingsDocument('screens', {screens: []}, 1),
      },
    });
    const view = renderHook(() =>
      useSettingsDocument('timers', 'Timer', onProblem),
    );
    await act(async () => Promise.resolve());
    expect(view.result.current).toBeNull();
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({key: 'screens:load:timers'}),
    );
  });
  it('reads an explicitly supplied editor API without a global API and releases its feed', async () => {
    const stop = vi.fn();
    const document = settingsDocument('timers', {timers: []}, 3);
    const api = mockLlpApi({
      settings: {get: async () => document, subscribe: () => stop},
    });
    delete window.llp;
    const view = renderHook(() =>
      useApiSettingsDocument({api, name: 'timers', title: '타이머'}),
    );
    await act(async () => Promise.resolve());
    expect(view.result.current).toEqual(document);
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
  it('clears a disabled read and ignores a previous activation when enabled again', async () => {
    const listeners = new Set<(document: SettingsDocument) => void>();
    const first = deferred<SettingsDocument>();
    const second = deferred<SettingsDocument>();
    const get = vi
      .fn<() => Promise<SettingsDocument>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    window.llp = mockLlpApi({
      settings: {
        get,
        subscribe: listener => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    });
    const problem = vi.fn<(notice: Notice) => void>();
    const view = renderHook(
      ({enabled}) =>
        useSettingsDocument(enabled ? 'timers' : null, '타이머', problem),
      {initialProps: {enabled: false}},
    );
    expect(get).not.toHaveBeenCalled();

    view.rerender({enabled: true});
    expect(get).toHaveBeenCalledOnce();
    view.rerender({enabled: false});
    expect(view.result.current).toBeNull();
    expect(listeners.size).toBe(0);
    view.rerender({enabled: true});
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () =>
      first.resolve(settingsDocument('timers', {timers: []}, 1)),
    );
    expect(view.result.current).toBeNull();
    await act(async () =>
      second.resolve(settingsDocument('timers', {timers: []}, 2)),
    );
    expect(view.result.current?.revision).toBe(2);
    view.unmount();

    expect(listeners.size).toBe(0);
  });
});

describe('a settings document mounted again', () => {
  it('starts from the newest document while another panel still follows it', async () => {
    const document = settingsDocument('timers', {timers: []}, 4);
    const later = deferred<SettingsDocument>();
    const get = vi
      .fn<() => Promise<SettingsDocument>>()
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce(document)
      .mockReturnValueOnce(later.promise);
    const api = mockLlpApi({settings: {get, subscribe: () => () => undefined}});
    const useTimers = () =>
      useApiSettingsDocument({api, name: 'timers', title: '타이머'});
    const follower = renderHook(useTimers);
    const first = renderHook(useTimers);
    await act(async () => Promise.resolve());
    first.unmount();
    const again = renderHook(useTimers);
    expect(again.result.current).toEqual(document);
    const newer = settingsDocument('timers', {timers: []}, 5);
    await act(async () => later.resolve(newer));
    expect(again.result.current).toEqual(newer);
    again.unmount();
    follower.unmount();
  });

  it('forgets the document once no panel follows it', async () => {
    const document = settingsDocument('timers', {timers: []}, 4);
    const later = deferred<SettingsDocument>();
    const get = vi
      .fn<() => Promise<SettingsDocument>>()
      .mockResolvedValueOnce(document)
      .mockReturnValueOnce(later.promise);
    const api = mockLlpApi({settings: {get, subscribe: () => () => undefined}});
    const useTimers = () =>
      useApiSettingsDocument({api, name: 'timers', title: '타이머'});
    const first = renderHook(useTimers);
    await act(async () => Promise.resolve());
    first.unmount();
    const again = renderHook(useTimers);
    expect(again.result.current).toBeNull();
    again.unmount();
  });
});
