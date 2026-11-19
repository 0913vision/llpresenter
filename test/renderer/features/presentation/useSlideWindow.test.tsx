import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useSlideWindow} from '@renderer/features/presentation/useSlideWindow';

function Grid({
  count = 100,
  live = null,
  width = 676,
  tileWidth = 160,
  itemId = 'song',
}: {
  count?: number;
  live?: number | null;
  width?: number;
  tileWidth?: number;
  itemId?: string;
}) {
  const keeper = useRef<HTMLDivElement>(null);
  const window = useSlideWindow(keeper, {
    count,
    live,
    width,
    tileWidth,
    columns: 4,
    gap: 12,
    itemId,
  });
  return (
    <div data-testid="viewport">
      <div ref={keeper} style={{height: window.height}}>
        <div role="listbox" aria-label="Slides">
          {Array.from({length: window.end - window.start}, (_, local) => {
            const index = window.start + local;
            return (
              <button
                key={index}
                role="option"
                aria-selected={false}
                aria-posinset={index + 1}
                aria-setsize={count}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
      this.dispatchEvent(new Event('scroll'));
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('mounts only visible rows and a margin, including both ends while scrolling', () => {
  render(<Grid />);
  expect(screen.getAllByRole('option')).toHaveLength(24);
  expect(screen.getAllByRole('option')[0]?.getAttribute('aria-posinset')).toBe(
    '1',
  );
  const viewport = screen.getByTestId('viewport');
  fireEvent.scroll(viewport, {target: {scrollTop: 1890}});
  expect(screen.getAllByRole('option')).toHaveLength(20);
  expect(
    screen.getAllByRole('option').at(-1)?.getAttribute('aria-posinset'),
  ).toBe('100');
  fireEvent.scroll(viewport, {target: {scrollTop: 0}});
  expect(screen.getAllByRole('option')[0]?.textContent).toBe('1');
});

it('smoothly follows outside the middle band and preserves a position inside it', () => {
  const view = render(<Grid />);
  const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
  view.rerender(<Grid live={4} />);
  expect(scrollTo).not.toHaveBeenCalled();
  view.rerender(<Grid live={12} />);
  expect(scrollTo).toHaveBeenLastCalledWith({top: 171, behavior: 'smooth'});
  scrollTo.mockClear();
  view.rerender(<Grid live={13} />);
  expect(scrollTo).not.toHaveBeenCalled();
  view.rerender(<Grid live={20} itemId="next" />);
  expect(scrollTo).toHaveBeenLastCalledWith({top: 351, behavior: 'smooth'});
});

it('uses the same target in a single-column list', () => {
  const view = render(<Grid width={160} />);
  view.rerender(<Grid width={160} live={3} />);
  expect(HTMLElement.prototype.scrollTo).toHaveBeenLastCalledWith({
    top: 171,
    behavior: 'smooth',
  });
});

it('waits for the last wheel or scrollbar drag before following the latest live slide', () => {
  vi.useFakeTimers();
  const view = render(<Grid />);
  const viewport = screen.getByTestId('viewport');
  const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
  fireEvent.wheel(viewport);
  view.rerender(<Grid live={12} />);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  fireEvent.wheel(viewport);
  view.rerender(<Grid live={20} />);
  act(() => {
    vi.advanceTimersByTime(1499);
  });
  expect(scrollTo).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(scrollTo).toHaveBeenLastCalledWith({top: 351, behavior: 'smooth'});
  scrollTo.mockClear();
  fireEvent.pointerDown(viewport);
  view.rerender(<Grid live={40} />);
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent.pointerUp(window);
  act(() => {
    vi.advanceTimersByTime(1500);
  });
  expect(scrollTo).toHaveBeenCalledOnce();
});

it('reveals a new live slide, adapts to zoom, and clamps after the list shrinks', () => {
  const view = render(<Grid />);
  view.rerender(<Grid live={99} />);
  const viewport = screen.getByTestId('viewport');
  expect(viewport.scrollTop).toBeGreaterThan(0);
  fireEvent.scroll(viewport);
  expect(screen.getByRole('option', {name: '100'})).toBeDefined();
  view.rerender(<Grid live={99} tileWidth={332} />);
  fireEvent.scroll(viewport);
  expect(screen.getAllByRole('option').length).toBeLessThan(12);
  view.rerender(<Grid count={3} />);
  fireEvent.scroll(viewport);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.getAllByRole('option')[0]?.textContent).toBe('1');
});

it('keeps the initial unmeasured window bounded', () => {
  render(<Grid tileWidth={0} width={0} />);
  expect(screen.getAllByRole('option')).toHaveLength(16);
});

it('remeasures a hidden resize and follows the live slide when ?? is revealed', async () => {
  let notify = (): void => undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  const view = render(
    <div data-workspace-frame="show" aria-hidden="false">
      <Grid live={60} />
    </div>,
  );
  const frame = view.container.querySelector('[data-workspace-frame]');
  const viewport = screen.getByTestId('viewport');
  if (!frame) throw new Error('Missing workspace frame');
  let height = 360;
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
  frame.setAttribute('aria-hidden', 'true');
  viewport.scrollTop = 0;
  height = 180;
  act(() => notify());
  expect(viewport.scrollTop).toBe(0);
  await act(async () => {
    frame.setAttribute('aria-hidden', 'false');
    await Promise.resolve();
  });
  expect(viewport.scrollTop).toBeGreaterThan(0);
  expect(screen.getByRole('option', {name: '61'})).toBeDefined();
});
