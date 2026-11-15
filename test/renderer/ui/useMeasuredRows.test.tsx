import {act, render, renderHook} from '@testing-library/react';
import {useRef} from 'react';
import {expect, it, vi} from 'vitest';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import {MeasuredRow} from '@renderer/features/service/slides/SlideRows';

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

it('remeasures mounted rows when the viewport observer runs after row measurements', () => {
  const observers = new Map<Element, () => void>();
  class Observer implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe = (node: Element): void => {
      observers.set(node, () => this.callback([], this));
    };
    disconnect = (): void => undefined;
    unobserve = (): void => undefined;
  }
  vi.stubGlobal('ResizeObserver', Observer);
  let width = 400;
  const widthSpy = vi
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(() => width);
  const rectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(DOMRect.fromRect({height: 153}));
  function Fixture() {
    const viewport = useRef<HTMLDivElement>(null);
    const {current, saveHeight} = useMeasuredRows('list', ['a', 'b'], viewport);
    return (
      <div
        ref={viewport}
        data-testid="viewport"
        data-heights={JSON.stringify(current.values)}
      >
        {['a', 'b'].map(id => (
          <MeasuredRow key={id} id={id} style={{}} onHeight={saveHeight}>
            {id}
          </MeasuredRow>
        ))}
      </div>
    );
  }
  const view = render(<Fixture />);
  try {
    const viewport = view.getByTestId('viewport');
    expect(JSON.parse(viewport.dataset['heights'] ?? '{}')).toEqual({
      a: 153,
      b: 153,
    });
    width = 394;
    act(() => observers.get(viewport)?.());
    expect(JSON.parse(viewport.dataset['heights'] ?? '{}')).toEqual({
      a: 153,
      b: 153,
    });
  } finally {
    view.unmount();
    widthSpy.mockRestore();
    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  }
});
