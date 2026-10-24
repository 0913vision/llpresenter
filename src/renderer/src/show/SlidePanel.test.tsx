import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {useLive} from '@renderer/state/live';
import {
  openItem,
  setThumbnailColumns,
  useShow,
  useThumbnailColumns,
} from '@renderer/state/show';
import {
  SlidePanelBody,
  SlidePanelMeta,
  ThumbnailSizeSlider,
} from './SlidePanel';

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

function Columns({
  sizeClass,
}: {
  readonly sizeClass: 'narrow' | 'normal' | 'wide';
}) {
  return <output>{useThumbnailColumns(sizeClass)}</output>;
}

beforeEach(() => {
  useShow.setState({openItemId: null, selectedTile: 0, thumbnailColumns: {}});
  useLive.setState({state: null});
});

afterEach(cleanup);

describe('SlidePanelMeta', () => {
  it('shows nothing when no item is open', () => {
    const {container} = render(<SlidePanelMeta />);
    expect(container.textContent).toBe('');
  });

  it('shows the item name and the 장 count when the item is not live', () => {
    openItem('song-morning');
    render(<SlidePanelMeta />);
    expect(screen.getByText('아침이 밝아 오네')).toBeTruthy();
    expect(screen.getByText('4장')).toBeTruthy();
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
    expect(screen.getByText('4장')).toBeTruthy();
  });

  it('follows the open item', () => {
    openItem('song-morning');
    render(<SlidePanelMeta />);
    act(() => openItem('song-river'));
    expect(screen.getByText('맑은 시냇물')).toBeTruthy();
    expect(screen.getByText('3장')).toBeTruthy();
  });
});

describe('thumbnail columns', () => {
  it('start at the default of each size class', () => {
    render(
      <>
        <Columns sizeClass="narrow" />
        <Columns sizeClass="normal" />
        <Columns sizeClass="wide" />
      </>,
    );
    expect(screen.getAllByRole('status').map(node => node.textContent)).toEqual(
      ['3', '4', '6'],
    );
  });

  it('are kept per size class and stay between 2 and 8', () => {
    setThumbnailColumns('normal', 1);
    expect(useShow.getState().thumbnailColumns.normal).toBe(2);
    setThumbnailColumns('normal', 20);
    expect(useShow.getState().thumbnailColumns.normal).toBe(8);
    setThumbnailColumns('narrow', 5.4);
    expect(useShow.getState().thumbnailColumns).toEqual({normal: 8, narrow: 5});
  });
});

describe('ThumbnailSizeSlider', () => {
  it('moves right for larger thumbnails, which means fewer columns', () => {
    render(<ThumbnailSizeSlider sizeClass="normal" />);
    const slider = screen.getByRole('slider', {name: '썸네일 크기'});
    expect(slider.getAttribute('value')).toBe('6');
    fireEvent.change(slider, {target: {value: '8'}});
    expect(useShow.getState().thumbnailColumns.normal).toBe(2);
    fireEvent.change(slider, {target: {value: '2'}});
    expect(useShow.getState().thumbnailColumns.normal).toBe(8);
  });

  it('changes only the columns of the grid, which follows the slider', () => {
    openItem('song-morning');
    render(
      <>
        <SlidePanelBody sizeClass="normal" />
        <ThumbnailSizeSlider sizeClass="normal" />
      </>,
    );
    const grid = screen.getByRole('listbox', {name: '장'});
    expect(grid.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    fireEvent.change(screen.getByRole('slider'), {target: {value: '7'}});
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });
});
