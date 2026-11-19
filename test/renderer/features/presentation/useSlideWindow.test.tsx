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
  startAtTop = false,
  onRender,
}: {
  count?: number;
  live?: number | null;
  width?: number;
  tileWidth?: number;
  itemId?: string;
  startAtTop?: boolean;
  onRender?: (start: number) => void;
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
    startAtTop,
  });
  onRender?.(window.start);
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

it('renders the prepared first window when switching from a scrolled Bible lookup', () => {
  const view = render(<Grid itemId="bible:first" startAtTop />);
  const viewport = screen.getByTestId('viewport');
  fireEvent.scroll(viewport, {target: {scrollTop: 720}});
  expect(screen.getAllByRole('option')[0]?.textContent).not.toBe('1');

  const onRender = vi.fn();
  view.rerender(<Grid itemId="bible:second" startAtTop onRender={onRender} />);
  expect(onRender).toHaveBeenNthCalledWith(1, 0);
  expect(viewport.scrollTop).toBe(0);
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

it('keeps the visible live slide in place when zoom changes the column count', () => {
  const view = render(<Grid live={20} />);
  const viewport = screen.getByTestId('viewport');
  fireEvent.scroll(viewport, {target: {scrollTop: 360}});
  view.rerender(<Grid live={20} tileWidth={180} />);
  // NOTE(0913vision): Slide 21 moves from row 5 at 90 px to row 6 at 101.25 px.
  expect(viewport.scrollTop).toBeCloseTo(517.5);
  expect(6 * 101.25 - viewport.scrollTop).toBeCloseTo(90);
});

it('anchors the first fully visible slide when the live slide is elsewhere', () => {
  const view = render(<Grid />);
  const viewport = screen.getByTestId('viewport');
  fireEvent.scroll(viewport, {target: {scrollTop: 360}});
  view.rerender(<Grid tileWidth={180} />);
  // NOTE(0913vision): Slide 17 was at the top, and moves from row 4 to row 5.
  expect(viewport.scrollTop).toBeCloseTo(506.25);
});

it('does not accumulate pixel rounding while the slider moves', () => {
  const view = render(<Grid live={20} />);
  const viewport = screen.getByTestId('viewport');
  let position = 360;
  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => position,
    set: (value: number) => {
      position = Math.round(value);
    },
  });
  fireEvent.scroll(viewport);
  for (let width = 161; width <= 180; width++) {
    view.rerender(<Grid live={20} tileWidth={width} />);
    fireEvent.scroll(viewport);
  }
  expect(Math.abs(6 * 101.25 - viewport.scrollTop - 90)).toBeLessThan(1);
});

it('chooses a new anchor after the operator scrolls', () => {
  const view = render(<Grid />);
  const viewport = screen.getByTestId('viewport');
  fireEvent.scroll(viewport, {target: {scrollTop: 360}});
  view.rerender(<Grid tileWidth={180} />);
  fireEvent.scroll(viewport, {target: {scrollTop: 200}});
  view.rerender(<Grid tileWidth={190} />);
  expect(viewport.scrollTop).toBeCloseTo(211.25);
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

it('follows the latest live slide when a kept frame returns without a size change', async () => {
  const view = render(
    <div data-workspace-frame="show" aria-hidden="false">
      <Grid live={0} />
    </div>,
  );
  const viewport = screen.getByTestId('viewport');
  view.rerender(
    <div data-workspace-frame="show" aria-hidden="true">
      <Grid live={60} />
    </div>,
  );
  expect(viewport.scrollTop).toBe(0);
  await act(async () => {
    view.rerender(
      <div data-workspace-frame="show" aria-hidden="false">
        <Grid live={60} />
      </div>,
    );
    await Promise.resolve();
  });
  expect(viewport.scrollTop).toBeGreaterThan(0);
  expect(screen.getByRole('option', {name: '61'})).toBeDefined();
});
