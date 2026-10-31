import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useElementSize} from './useElementSize';

function entry(
  target: Element,
  width: number,
  height: number,
): ResizeObserverEntry {
  return {
    target,
    contentRect: new DOMRectReadOnly(0, 0, width, height),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

it('keeps the same size object for repeated measurements and ignores replaced observers', () => {
  const observers: Array<{
    measure: (target: Element, width: number, height: number) => void;
    disconnect: () => void;
  }> = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          measure: (target, width, height) =>
            callback([entry(target, width, height)], this),
          disconnect: this.disconnect,
        });
      }
      observe(): void {}
      unobserve(): void {}
      disconnect = vi.fn();
    },
  );
  const {result, unmount} = renderHook(() => useElementSize());
  const first = document.createElement('div');
  const second = document.createElement('div');
  act(() => result.current[0](first));
  const old = observers[0];
  if (old === undefined) throw new Error('Missing first observer');
  act(() => old.measure(first, 400, 300));
  const measured = result.current[1];
  expect(measured).toEqual({width: 400, height: 300});
  act(() => old.measure(first, 400, 300));
  expect(result.current[1]).toBe(measured);
  act(() => result.current[0](second));
  const current = observers[1];
  if (current === undefined) throw new Error('Missing second observer');
  act(() => current.measure(second, 600, 450));
  act(() => old.measure(first, 100, 75));
  expect(result.current[1]).toEqual({width: 600, height: 450});
  unmount();
  expect(old.disconnect).toHaveBeenCalled();
  expect(current.disconnect).toHaveBeenCalled();
});
