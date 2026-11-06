import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {LayoutChange} from '@core/schema/uiState';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {openItem, useShow} from '@renderer/session/show';
import {openLibrarySong} from '@renderer/session/showLibrary';
import {createMediaId, createSongId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {seedThumbnailScale} from '@renderer/platform/thumbnailScale';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlidePanelFooter,
  SlideSizeControl,
} from '@renderer/features/presentation/SlidePanel';

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
  window.llp = mockLlpApi({ui: {setLayout}});
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

  it('shows the item name without a header count when the item is not live', () => {
    openItem('song-morning');
    render(<SlidePanelMeta />);
    expect(screen.getByText('아침이 밝아 오네')).toBeTruthy();
    expect(screen.queryByText('슬라이드 4개')).toBeNull();
  });

  it('shows the live position of the open item', () => {
    openItem('song-morning');
    setLiveSlide('song-morning', 1);
    render(<SlidePanelMeta />);
    expect(screen.getByText('2 / 4')).toBeTruthy();
  });

  it('follows the open item', () => {
    openItem('song-morning');
    render(
      <>
        <SlidePanelMeta />
        <SlidePanelFooter sizeClass="normal" />
      </>,
    );
    act(() => openItem('song-river'));
    expect(screen.getByText('맑은 시냇물')).toBeTruthy();
    expect(screen.getByText('3개')).toBeTruthy();
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
});

describe('SlidePanel with a library source', () => {
  function librarySong(
    overrides: Partial<ShowLibrarySong> = {},
  ): ShowLibrarySong {
    return {
      songId: createSongId('10000000-0000-4000-8000-000000000001'),
      songRevision: 1,
      title: '새벽의 빛',
      readOnly: false,
      tiles: [
        {label: '1절', labelColor: '#5FB8C2', lines: ['창작한 첫 줄']},
        {label: '후렴', labelColor: '#D68F5F', lines: ['창작한 두 번째 줄']},
      ],
      jumpKeys: {},
      background: {
        mediaId: createMediaId('30000000-0000-4000-8000-000000000001'),
        loop: true,
      },
      ...overrides,
    };
  }

  afterEach(() => {
    useShow.setState({librarySong: null});
  });

  it('shows the source title, its 장 count, and its lyrics', () => {
    openLibrarySong(librarySong());
    render(
      <>
        <SlidePanelMeta />
        <SlidePanelBody sizeClass="normal" />
        <SlidePanelFooter sizeClass="normal" />
      </>,
    );

    expect(screen.getByText('새벽의 빛')).toBeDefined();
    expect(screen.getByText('2개')).toBeDefined();
    expect(screen.getByText('창작한 첫 줄')).toBeDefined();
  });

  it.each([
    {
      source: librarySong({readOnly: true}),
      reason: '새 버전의 파일이라 바꿀 수 없습니다',
    },
    {
      source: librarySong({problem: 'missing-background'}),
      reason: '배경 파일을 찾을 수 없음',
    },
  ])('shows the library source problem: $reason', ({source, reason}) => {
    openLibrarySong(source);
    render(<SlidePanelMeta />);
    expect(screen.getByRole('img', {name: reason})).toBeDefined();
  });
});
