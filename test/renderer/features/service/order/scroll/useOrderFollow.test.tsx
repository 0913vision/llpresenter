import {act, fireEvent, render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useRef} from 'react';
import {useOrderFollow} from '@renderer/features/service/order/scroll/useOrderFollow';

function Harness({
  target,
  liveItemId,
  enabled = true,
  revision = 0,
}: {
  readonly target: string | null;
  readonly liveItemId: string | null;
  readonly enabled?: boolean;
  readonly revision?: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  useOrderFollow(list, {target, liveItemId, enabled});
  return (
    <div data-testid="viewport">
      <div ref={list} data-revision={revision}>
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

function measure(viewport: HTMLElement): void {
  Object.defineProperty(viewport, 'clientHeight', {value: 400});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return DOMRect.fromRect({
        y:
          this === viewport
            ? 0
            : this.dataset['orderId'] === 'last'
              ? 690
              : 150,
        height: this === viewport ? 400 : 20,
      });
    },
  );
}

describe('service order follow', () => {
  it('positions the live or selected row before paint when entering', () => {
    const view = render(
      <Harness target="last" liveItemId="last" enabled={false} />,
    );
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    view.rerender(<Harness target="last" liveItemId="last" />);
    expect(viewport.scrollTop).toBe(540);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps manual scroll after service pushes, same-item slide updates, selection changes, and time', () => {
    vi.useFakeTimers();
    const view = render(
      <Harness target="first" liveItemId="first" enabled={false} />,
    );
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    view.rerender(<Harness target="first" liveItemId="first" />);
    viewport.scrollTop = 200;
    fireEvent.wheel(viewport);
    fireEvent.scroll(viewport);
    view.rerender(<Harness target="first" liveItemId="first" revision={1} />);
    view.rerender(<Harness target="last" liveItemId="first" revision={2} />);
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    expect(viewport.scrollTop).toBe(200);
  });

  it('brings a newly live offscreen row just into view immediately, even after a manual scroll', () => {
    const view = render(
      <Harness target="first" liveItemId="first" enabled={false} />,
    );
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    view.rerender(<Harness target="first" liveItemId="first" />);
    viewport.scrollTop = 200;
    fireEvent.wheel(viewport);
    view.rerender(<Harness target="last" liveItemId="last" />);
    expect(viewport.scrollTop).toBe(510);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('leaves a newly live visible row in place', () => {
    const view = render(
      <Harness target="last" liveItemId="last" enabled={false} />,
    );
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    view.rerender(<Harness target="last" liveItemId="last" />);
    viewport.scrollTop = 200;
    view.rerender(<Harness target="first" liveItemId="first" />);
    expect(viewport.scrollTop).toBe(200);
  });
});
