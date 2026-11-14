import {act, fireEvent, render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useRef} from 'react';
import {useOrderFollow} from '@renderer/features/service/order/useOrderFollow';

function Harness({
  target,
  enabled = true,
}: {
  readonly target: string | null;
  readonly enabled?: boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  useOrderFollow(list, {target, enabled, rows: []});
  return (
    <div data-testid="viewport">
      <div ref={list}>
        <div data-order-id="first" />
        <div data-order-id="last" />
      </div>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('service order follow', () => {
  it('positions the item immediately on entry without a smooth scroll', () => {
    const view = render(<Harness target="last" enabled={false} />);
    const viewport = view.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {value: 400});
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return DOMRect.fromRect({
          y: this === viewport ? 0 : 690,
          height: this === viewport ? 400 : 20,
        });
      },
    );
    view.rerender(<Harness target="last" />);
    expect(viewport.scrollTop).toBe(540);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('positions an out-of-band item at 40% and leaves an item already in the band', () => {
    const view = render(<Harness target={null} />);
    const viewport = view.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {value: 400});
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const center = this.dataset['orderId'] === 'last' ? 700 : 160;
        return DOMRect.fromRect({
          y: this === viewport ? 0 : center - 10,
          height: this === viewport ? 400 : 20,
        });
      },
    );
    view.rerender(<Harness target="first" />);
    expect(scrollTo).not.toHaveBeenCalled();
    view.rerender(<Harness target="last" />);
    expect(scrollTo).toHaveBeenCalledWith({top: 540, behavior: 'smooth'});
    view.rerender(<Harness target="first" enabled={false} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
  it('defers following a changed live item until manual scrolling has paused', () => {
    vi.useFakeTimers();
    const view = render(<Harness target={null} />);
    const viewport = view.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {value: 400});
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return DOMRect.fromRect({
          y:
            this === viewport
              ? 0
              : this.dataset['orderId'] === 'first'
                ? 150
                : 690,
          height: this === viewport ? 400 : 20,
        });
      },
    );
    view.rerender(<Harness target="first" />);
    fireEvent.wheel(viewport);
    view.rerender(<Harness target="last" />);
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(scrollTo).toHaveBeenCalledWith({top: 540, behavior: 'smooth'});
  });
});
