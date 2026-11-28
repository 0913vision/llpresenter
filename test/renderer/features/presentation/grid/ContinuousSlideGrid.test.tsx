import {scrollGridToItem} from '@renderer/session/show/visibleSlideItem';
import {lyricsSlide} from '@fixtures/core/slides';
import {shownText} from '@fixtures/core/liveSlide';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ContinuousSlideGrid} from '@renderer/features/presentation/grid/ContinuousSlideGrid';
import {applyService, openItem} from '@renderer/session/show/show';
import {useLive} from '@renderer/session/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/schema/live/live';
import {liveReturn} from '@renderer/session/show/liveReturn';
import {SlidePanelMeta} from '@renderer/features/presentation/grid/SlidePanel';
import {useShow} from '@renderer/session/show/showStore';

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
      one: [
        {
          slide: lyricsSlide(1, 'First slide'),
          auto: {},
          caption: null,
          labelColor: 'none',
        },
      ],
      two: [
        {
          slide: lyricsSlide(2, 'Second slide'),
          auto: {},
          caption: null,
          labelColor: 'none',
        },
      ],
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
  // NOTE(0913vision): A band shows the item's name and no slide count (USER
  // Nov 27).
  expect(screen.getByText('Second').parentElement?.textContent).toBe('Second');
  expect(screen.getByText('Second')).toBeTruthy();
  expect(screen.getAllByRole('option')).toHaveLength(2);
  act(() => {
    scrollGridToItem('two');
  });
  expect(viewport.scrollTo).toHaveBeenCalled();
  const second = screen.getAllByRole('option')[1];
  if (!second) throw new Error('Missing second slide');
  fireEvent.click(second);
  expect(useShow.getState().openItemId).toBe('two');
  expect(send).toHaveBeenCalled();
});

it('shows the next item in the panel header when a section heading is at the top and nothing is live', () => {
  const {container} = render(
    <>
      <div data-testid="panel-meta">
        <SlidePanelMeta />
      </div>
      <div>
        <ContinuousSlideGrid columns={4} scalePercent={100} />
      </div>
    </>,
  );
  const viewport = container.querySelector<HTMLElement>(
    '[data-show-slide-grid]',
  )?.parentElement;
  if (!viewport) throw new Error('Missing viewport');
  Object.defineProperty(viewport, 'clientHeight', {value: 300});
  viewport.scrollTo = vi.fn();
  act(() => Observer.all.forEach(observer => observer.report()));
  const section = screen.getByRole('heading', {name: 'Section'}).parentElement;
  if (!section) throw new Error('Missing section');
  viewport.scrollTop = Number.parseFloat(section.style.top);
  fireEvent.scroll(viewport);
  expect(screen.getByTestId('panel-meta').textContent).toBe('Second');
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
            ...shownText(['Live']),
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

/** A service of six songs of four slides each, taller than the view. */
function applyLongService(): void {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  applyService({
    id: 'service',
    name: 'Service',
    revision: 2,
    readOnly: false,
    rows: ids.map(id => ({id, kind: 'song', title: `Song ${id}`})),
    tiles: Object.fromEntries(
      ids.map((id, at) => [
        id,
        [1, 2, 3, 4].map(n => ({
          slide: lyricsSlide(at * 10 + n, `${id} ${n}`),
          auto: {},
          caption: null,
          labelColor: 'none' as const,
        })),
      ]),
    ),
  });
  openItem('a');
}

it('keeps the keyboard in the grid when the band that held it scrolls out of its window', () => {
  applyLongService();
  const viewport = measuredViewport();
  const first = screen.getAllByRole('listbox')[0];
  if (!first) throw new Error('Missing listbox');
  act(() => first.focus());
  fireEvent.wheel(viewport);
  viewport.scrollTop = 600;
  fireEvent.scroll(viewport);
  expect(first.isConnected).toBe(false);
  expect(document.activeElement?.getAttribute('role')).toBe('listbox');
  expect(viewport.contains(document.activeElement)).toBe(true);
});

it('lets the grid go once the operator clicks elsewhere', () => {
  applyLongService();
  const viewport = measuredViewport();
  const first = screen.getAllByRole('listbox')[0];
  if (!first) throw new Error('Missing listbox');
  act(() => first.focus());
  fireEvent.pointerDown(document.body);
  act(() => first.blur());
  fireEvent.wheel(viewport);
  viewport.scrollTop = 600;
  fireEvent.scroll(viewport);
  expect(document.activeElement).toBe(document.body);
});
