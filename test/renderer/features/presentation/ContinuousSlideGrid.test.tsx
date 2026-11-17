import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ContinuousSlideGrid} from '@renderer/features/presentation/ContinuousSlideGrid';
import {applyService, openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

class Observer implements ResizeObserver {
  static all: Observer[] = [];
  targets = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    Observer.all.push(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
  report(): void {
    for (const target of this.targets) {
      const contentRect = DOMRectReadOnly.fromRect({width: 600, height: 300});
      this.callback(
        [
          {
            target,
            contentRect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    }
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer);
  window.llp = mockLlpApi();
  useLive.setState({state: null});
  applyService({
    id: 'service',
    name: 'Service',
    revision: 1,
    readOnly: false,
    rows: [
      {id: 'one', kind: 'song', title: 'First'},
      {id: 'header', kind: 'header', title: 'Section'},
      {id: 'two', kind: 'song', title: 'Second'},
    ],
    tiles: {
      one: [{label: null, labelColor: 'none', lines: ['First slide']}],
      two: [{label: null, labelColor: 'none', lines: ['Second slide']}],
    },
  });
  openItem('one');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Observer.all = [];
  delete window.llp;
});

it('windows ordered item bands, scrolls to a requested item, and outputs its tile', async () => {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const {container} = render(
    <div>
      <ContinuousSlideGrid columns={4} scalePercent={100} />
    </div>,
  );
  const keeper = container.querySelector<HTMLElement>('[data-show-slide-grid]');
  if (!keeper?.parentElement) throw new Error('Missing viewport');
  const viewport = keeper.parentElement;
  Object.defineProperty(viewport, 'clientHeight', {value: 1000});
  viewport.scrollTo = vi.fn();
  act(() => Observer.all.forEach(observer => observer.report()));
  expect(screen.getByText('First')).toBeTruthy();
  expect(screen.getByText('Section')).toBeTruthy();
  expect(screen.getByText('Second')).toBeTruthy();
  expect(screen.getAllByRole('option')).toHaveLength(2);
  act(() => {
    window.dispatchEvent(new CustomEvent('show-grid-item', {detail: 'two'}));
  });
  expect(viewport.scrollTo).toHaveBeenCalled();
  const second = screen.getAllByRole('option')[1];
  if (!second) throw new Error('Missing second slide');
  fireEvent.click(second);
  expect(useShow.getState().openItemId).toBe('two');
  expect(send).toHaveBeenCalled();
});
