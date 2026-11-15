import {render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useRef} from 'react';
import {usePrepOrderPosition} from '@renderer/features/service/order/usePrepOrderPosition';

function Harness({
  target,
  enabled,
}: {
  readonly target: string | null;
  readonly enabled: boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  usePrepOrderPosition(list, {target, enabled, rows: []});
  return (
    <div data-testid="viewport" style={{overflowY: 'auto'}}>
      <div>
        <div ref={list}>
          <div role="option" data-value="visible" />
          <div role="option" data-value="far" />
        </div>
      </div>
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

function measure(viewport: HTMLElement): void {
  Object.defineProperty(viewport, 'clientHeight', {value: 400});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return DOMRect.fromRect({
        y: this === viewport ? 0 : this.dataset['value'] === 'far' ? 690 : 50,
        height: this === viewport ? 400 : 20,
      });
    },
  );
}

describe('preparing the order position', () => {
  it('positions an offscreen selection immediately on entry and does not follow later selection changes', () => {
    const view = render(<Harness target="far" enabled={false} />);
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    const scrollTo = vi.fn();
    viewport.scrollTo = scrollTo;
    view.rerender(<Harness target="far" enabled />);
    expect(viewport.scrollTop).toBe(540);
    expect(scrollTo).not.toHaveBeenCalled();
    view.rerender(<Harness target="visible" enabled />);
    expect(viewport.scrollTop).toBe(540);
  });

  it('keeps a visible selection in place and repositions on a later entry', () => {
    const view = render(<Harness target="visible" enabled={false} />);
    const viewport = view.getByTestId('viewport');
    measure(viewport);
    view.rerender(<Harness target="visible" enabled />);
    expect(viewport.scrollTop).toBe(0);
    view.rerender(<Harness target="far" enabled={false} />);
    view.rerender(<Harness target="far" enabled />);
    expect(viewport.scrollTop).toBe(540);
  });
});
