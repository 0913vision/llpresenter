import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';

it('keeps current row heights and clears them when scope or viewport width changes', () => {
  let notify: (() => void) | undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  class Observer implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = () => callback([], this);
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', Observer);
  const viewport = document.createElement('div');
  let width = 400;
  Object.defineProperty(viewport, 'clientWidth', {get: () => width});
  const ref = {current: viewport};
  const {result, rerender, unmount} = renderHook(
    ({scope, ids}: {scope: string; ids: string[]}) =>
      useMeasuredRows(scope, ids, ref),
    {initialProps: {scope: 'list:100', ids: ['a', 'b']}},
  );
  try {
    expect(observe).toHaveBeenCalledWith(viewport);
    act(() => {
      result.current.saveHeight('a', 120);
      result.current.saveHeight('b', 150);
      result.current.saveHeight('missing', 999);
    });
    expect(result.current.current.values).toEqual({a: 120, b: 150});
    rerender({scope: 'list:100', ids: ['b', 'c']});
    expect(result.current.current.values).toEqual({b: 150});
    act(() => notify?.());
    expect(result.current.current.values).toEqual({b: 150});
    width = 500;
    act(() => notify?.());
    expect(result.current.current.values).toEqual({});
    act(() => result.current.saveHeight('b', 180));
    const oldSave = result.current.saveHeight;
    rerender({scope: 'grid:100', ids: ['b', 'c']});
    expect(result.current.current.values).toEqual({});
    act(() => oldSave('b', 180));
    expect(result.current.current.values).toEqual({});
  } finally {
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  }
});
