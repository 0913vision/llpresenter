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
  const current = SizeObserver.current;
  if (current === null) throw new Error('no replacement observer');
  expect([...observer.observed]).toEqual([]);
  expect([...current.observed]).toEqual([second]);

  act(() => observer.report(first, 0));
  expect(screen.getByRole('status').textContent).toBe('0');
  act(() => current.report(second, 720));
  expect(screen.getByRole('status').textContent).toBe('720');
});
