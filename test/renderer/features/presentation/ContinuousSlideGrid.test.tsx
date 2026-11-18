import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ContinuousSlideGrid} from '@renderer/features/presentation/ContinuousSlideGrid';
import {applyService, openItem, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {liveReturn} from '@renderer/features/presentation/liveReturn';

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
      {id: 'empty', kind: 'song', title: 'Empty'},
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
  const heading = screen.getByRole('heading', {name: 'Section'});
  expect(heading.textContent).toBe('Section');
  expect(screen.getByText('Empty').parentElement?.textContent).toBe('Empty');
  expect(screen.getByText('Second').parentElement?.textContent).toBe('Second1');
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

function setLive(itemId: string): void {
  const state = emptyLiveState();
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId,
            position: 0,
            label: null,
            lines: ['Live'],
          },
        },
      },
    }),
  );
}

function measuredViewport(): HTMLElement {
  const {container} = render(
    <ContinuousSlideGrid columns={4} scalePercent={100} />,
  );
  const viewport = container.querySelector<HTMLElement>(
    '[data-show-slide-grid]',
  )?.parentElement;
  if (!viewport) throw new Error('Missing viewport');
  Object.defineProperty(viewport, 'clientHeight', {value: 300});
  viewport.scrollTo = vi.fn();
  act(() => Observer.all.forEach(observer => observer.report()));
  return viewport;
}

it('follows a key past the reading line during the wheel pause', () => {
  setLive('one');
  const viewport = measuredViewport();
  vi.mocked(viewport.scrollTo).mockClear();
  fireEvent.wheel(viewport);
  fireEvent.keyDown(window, {key: 'ArrowDown', code: 'ArrowDown'});
  setLive('two');
  expect(viewport.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({behavior: 'smooth'}),
  );
});

it('does not follow an in-view click after a key press', () => {
  setLive('one');
  const viewport = measuredViewport();
  vi.mocked(viewport.scrollTo).mockClear();
  fireEvent.keyDown(window, {key: 'ArrowDown', code: 'ArrowDown'});
  fireEvent.pointerDown(screen.getByText('Second'));
  setLive('two');
  expect(viewport.scrollTo).not.toHaveBeenCalled();
});

it('returns to the live tile after scrolling it out of view', () => {
  setLive('one');
  const viewport = measuredViewport();
  fireEvent.wheel(viewport);
  viewport.scrollTop = 400;
  fireEvent.scroll(viewport);
  expect(liveReturn.get()).toBe('away');
  vi.mocked(viewport.scrollTo).mockClear();
  act(() => liveReturn.go());
  expect(viewport.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({top: 0, behavior: 'smooth'}),
  );
});
