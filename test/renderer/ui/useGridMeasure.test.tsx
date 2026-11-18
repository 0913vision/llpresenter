import {useRef} from 'react';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useGridMeasure} from '@renderer/ui/useGridMeasure';

class SizeObserver implements ResizeObserver {
  static current: SizeObserver | null = null;
  readonly observed = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    SizeObserver.current = this;
  }
  observe(target: Element): void {
    this.observed.add(target);
  }
  unobserve(target: Element): void {
    this.observed.delete(target);
  }
  disconnect(): void {
    this.observed.clear();
  }
  report(target: Element, width: number): void {
    const contentRect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width,
      height: 0,
      top: 0,
      right: width,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    };
    const entry: ResizeObserverEntry = {
      target,
      contentRect,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };
    this.callback([entry], this);
  }
}

function Measured({itemKey}: {readonly itemKey: string}) {
  const container = useRef<HTMLDivElement>(null);
  const {width} = useGridMeasure(container, '[role="listbox"]');
  return (
    <div ref={container}>
      <output>{width}</output>
      <div key={itemKey} role="listbox" aria-label={itemKey} />
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', SizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  SizeObserver.current = null;
});

it('follows the grid element that replaces the previous one', async () => {
  const {rerender} = render(<Measured itemKey="first" />);
  const observer = SizeObserver.current;
  if (observer === null) throw new Error('no observer');
  const first = screen.getByRole('listbox', {name: 'first'});
  act(() => observer.report(first, 640));
  expect(screen.getByRole('status').textContent).toBe('640');

  rerender(<Measured itemKey="second" />);
  await act(async () => {
    await Promise.resolve();
  });
  const second = screen.getByRole('listbox', {name: 'second'});
  expect([...observer.observed]).toEqual([second]);

  act(() => observer.report(first, 0));
  expect(screen.getByRole('status').textContent).toBe('640');
  act(() => observer.report(second, 720));
  expect(screen.getByRole('status').textContent).toBe('720');
});

it('holds a hidden frame measurement and applies the newest size when shown', async () => {
  const view = render(
    <div data-workspace-frame="show" aria-hidden="false">
      <Measured itemKey="first" />
    </div>,
  );
  const frame = view.container.querySelector('[data-workspace-frame]');
  const grid = view.container.querySelector('[role="listbox"]');
  const output = view.container.querySelector('output');
  const observer = SizeObserver.current;
  if (!frame || !grid || !output || !observer) throw new Error('Missing grid');
  act(() => observer.report(grid, 640));
  expect(output.textContent).toBe('640');
  frame.setAttribute('aria-hidden', 'true');
  act(() => {
    observer.report(grid, 700);
    observer.report(grid, 720);
  });
  expect(output.textContent).toBe('640');
  await act(async () => {
    frame.setAttribute('aria-hidden', 'false');
    await Promise.resolve();
  });
  expect(output.textContent).toBe('720');
});

it('rechecks the replacement grid when a hidden frame is shown', async () => {
  const view = render(
    <div data-workspace-frame="show" aria-hidden="false">
      <Measured itemKey="first" />
    </div>,
  );
  const observer = SizeObserver.current;
  const first = view.container.querySelector('[role="listbox"]');
  const frame = view.container.querySelector('[data-workspace-frame]');
  const output = view.container.querySelector('output');
  if (!observer || !first || !frame || !output) throw new Error('Missing grid');
  act(() => observer.report(first, 600));
  view.rerender(
    <div data-workspace-frame="show" aria-hidden="true">
      <Measured itemKey="second" />
    </div>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  const second = view.container.querySelector('[role="listbox"]');
  if (!second) throw new Error('Missing replacement');
  act(() => {
    observer.report(first, 100);
    observer.report(second, 750);
  });
  expect(output.textContent).toBe('600');
  await act(async () => {
    view.rerender(
      <div data-workspace-frame="show" aria-hidden="false">
        <Measured itemKey="second" />
      </div>,
    );
    await Promise.resolve();
  });
  expect(output.textContent).toBe('750');
});
