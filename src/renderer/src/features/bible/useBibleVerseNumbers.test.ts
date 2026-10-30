import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {defaultPreferences, type Preferences} from '@core/schema/preferences';
import {useBibleVerseNumbers} from './useBibleVerseNumbers';

function preferences(verseNumbers: boolean): Preferences {
  return {
    ...defaultPreferences,
    bible: {...defaultPreferences.bible, verseNumbers},
  };
}

function reader() {
  let finish: (value: Preferences) => void = () => undefined;
  let fail: (reason: unknown) => void = () => undefined;
  const pending = new Promise<Preferences>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const listeners = new Set<(value: Preferences) => void>();
  const stop = vi.fn();
  const api = {
    get: vi.fn(() => pending),
    subscribe: vi.fn((listener: (value: Preferences) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        stop();
      };
    }),
  };
  return {
    api,
    finish: (numbers: boolean) => finish(preferences(numbers)),
    fail,
    stop,
    emit: (numbers: boolean) => {
      for (const listener of listeners) listener(preferences(numbers));
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('Bible verse-number defaults', () => {
  it('waits for the default and does not replace a newer push with its stale startup read', async () => {
    const fixture = reader();
    const view = renderHook(() => useBibleVerseNumbers(fixture.api));
    expect(view.result.current).toBeNull();
    act(() => fixture.emit(false));
    expect(view.result.current).toBe(false);
    await act(async () => fixture.finish(true));
    expect(view.result.current).toBe(false);
    act(() => fixture.emit(true));
    expect(view.result.current).toBe(true);
    view.unmount();
    expect(fixture.stop).toHaveBeenCalledOnce();
  });

  it('drops the old owner while a replacement reader is still pending', async () => {
    const first = reader();
    const second = reader();
    const view = renderHook(({api}) => useBibleVerseNumbers(api), {
      initialProps: {api: first.api},
    });
    await act(async () => first.finish(false));
    expect(view.result.current).toBe(false);
    const latePush = first.api.subscribe.mock.calls[0]?.[0];
    view.rerender({api: second.api});
    expect(view.result.current).toBeNull();
    act(() => latePush?.(preferences(true)));
    expect(view.result.current).toBeNull();
    await act(async () => second.finish(true));
    expect(view.result.current).toBe(true);
    expect(first.stop).toHaveBeenCalledOnce();
    view.unmount();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it('releases its subscription and ignores a rejected startup read after unmount', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fixture = reader();
    const view = renderHook(() => useBibleVerseNumbers(fixture.api));
    view.unmount();
    await act(async () => fixture.fail(new Error('Invented late failure')));
    expect(fixture.stop).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps the field pending and logs a failed default read while mounted', async () => {
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fixture = reader();
    const view = renderHook(() => useBibleVerseNumbers(fixture.api));
    const failure = new Error('Invented preference failure');
    await act(async () => fixture.fail(failure));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Could not read Bible display preferences',
        failure,
      ),
    );
    expect(view.result.current).toBeNull();
  });
});
