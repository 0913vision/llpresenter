import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {LayoutChange} from '@core/schema/uiState';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {openItem, useShow} from '@renderer/state/show';
import {seedThumbnailScale} from '@renderer/state/thumbnailScale';
import {seedSampleService} from './testing/sampleService';
import {SlidePanelBody, SlidePanelMeta, SlideSizeControl} from './SlidePanel';

const GRID_WIDTH = 600;
const setLayout = vi.fn<(change: LayoutChange) => void>();

function setLiveSlide(itemId: string, position: number): void {
  const base = emptyLiveState();
  useLive.setState({
    state: {
      ...base,
      layers: {
        ...base.layers,
        slide: {itemId, position, label: null, lines: ['x']},
      },
    },
  });
}

class FixedWidthObserver implements ResizeObserver {
  static readonly observers = new Set<FixedWidthObserver>();

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    FixedWidthObserver.observers.add(this);
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRectReadOnly(0, 0, GRID_WIDTH, 0),
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };
    this.callback([entry], this);
  }

  unobserve(): void {}

  disconnect(): void {
    FixedWidthObserver.observers.delete(this);
  }
}

function renderPanel(sizeClass: 'narrow' | 'normal' | 'wide') {
  return render(
    <>
      <SlidePanelBody sizeClass={sizeClass} />
      <SlideSizeControl sizeClass={sizeClass} />
    </>,
  );
}

function gridStyle(): CSSStyleDeclaration {
  return screen.getByRole('listbox', {name: '슬라이드'}).style;
}

beforeEach(() => {
  seedSampleService();
  seedThumbnailScale({});
  setLayout.mockReset();
  window.llp = fakeLlpApi({ui: {setLayout}});
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.llp;
});

describe('SlidePanelMeta', () => {
  it('shows nothing when no item is open', () => {
    const {container} = render(<SlidePanelMeta />);
    expect(container.textContent).toBe('');
  });

  it('shows the item name and the slide count when the item is not live', () => {
    openItem('song-morning');
    render(<SlidePanelMeta />);
    expect(screen.getByText('아침이 밝아 오네')).toBeTruthy();
    expect(screen.getByText('슬라이드 4개')).toBeTruthy();
  });

  it('shows the live position of the open item', () => {
    openItem('song-morning');
    setLiveSlide('song-morning', 1);
    render(<SlidePanelMeta />);
    expect(screen.getByText('2 / 4')).toBeTruthy();
  });

  it('shows the count when another item is live', () => {
    openItem('song-morning');
    setLiveSlide('song-river', 0);
    render(<SlidePanelMeta />);
    expect(screen.getByText('슬라이드 4개')).toBeTruthy();
  });

  it('follows the open item', () => {
    openItem('song-morning');
    render(<SlidePanelMeta />);
    act(() => openItem('song-river'));
    expect(screen.getByText('맑은 시냇물')).toBeTruthy();
    expect(screen.getByText('슬라이드 3개')).toBeTruthy();
  });
});

describe('SlidePanelBody', () => {
  it('fills the columns of its size class until the grid is measured', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    openItem('song-morning');
    renderPanel('wide');
    expect(gridStyle().getPropertyValue('--thumb-columns')).toBe('6');
    expect(gridStyle().getPropertyValue('--thumb-width')).toBe('');
  });

  it('sizes the slides from the measured width, the size class, and the size', () => {
    vi.stubGlobal('ResizeObserver', FixedWidthObserver);
    openItem('song-morning');
    seedThumbnailScale({layout: {normal: {thumbnailScalePercent: 50}}});
    renderPanel('normal');
    expect(gridStyle().getPropertyValue('--thumb-width')).toBe('75px');
  });

  it('stops measuring when it unmounts', () => {
    vi.stubGlobal('ResizeObserver', FixedWidthObserver);
    const {unmount} = renderPanel('normal');
    expect(FixedWidthObserver.observers.size).toBe(1);
    unmount();
    expect(FixedWidthObserver.observers.size).toBe(0);
  });
});

describe('SlideSizeControl', () => {
  it('resizes the slides during a drag and saves the size once it ends', () => {
    vi.stubGlobal('ResizeObserver', FixedWidthObserver);
    openItem('song-morning');
    renderPanel('normal');
    const slider = screen.getByRole('slider', {name: '슬라이드 크기'});
    Object.defineProperty(slider, 'setPointerCapture', {value: vi.fn()});
    expect(gridStyle().getPropertyValue('--thumb-width')).toBe('150px');
    fireEvent.pointerDown(slider, {pointerId: 1, button: 0});
    fireEvent.change(slider, {target: {value: '150.5'}});
    expect(gridStyle().getPropertyValue('--thumb-width')).toBe('225.75px');
    expect(setLayout).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider, {pointerId: 1});
    expect(setLayout).toHaveBeenCalledExactlyOnceWith({
      sizeClass: 'normal',
      thumbnailScalePercent: 151,
    });
    expect(gridStyle().getPropertyValue('--thumb-width')).toBe('226.5px');
  });

  it('drops a % draft when the size class changes during the edit', () => {
    const percentField = (): HTMLElement =>
      screen.getByRole('spinbutton', {name: '슬라이드 크기 백분율'});
    const {rerender} = render(<SlideSizeControl sizeClass="narrow" />);
    fireEvent.change(percentField(), {target: {value: '150'}});
    rerender(<SlideSizeControl sizeClass="normal" />);
    fireEvent.keyDown(percentField(), {key: 'Enter'});
    fireEvent.blur(percentField());
    expect(setLayout).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('slider', {name: '슬라이드 크기'})
        .getAttribute('aria-valuetext'),
    ).toBe('100%');
  });

  it('keeps a size per size class', () => {
    seedThumbnailScale({layout: {wide: {thumbnailScalePercent: 80}}});
    render(
      <>
        <SlideSizeControl sizeClass="normal" />
        <SlideSizeControl sizeClass="wide" />
      </>,
    );
    const values = screen
      .getAllByRole('slider', {name: '슬라이드 크기'})
      .map(slider => slider.getAttribute('aria-valuetext'));
    expect(values).toEqual(['100%', '80%']);
  });
});
