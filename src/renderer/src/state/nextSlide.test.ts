import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {useLive} from './live';
import {openItem, useNextSlideLayer, useShow} from './show';

function setLive(itemId: string, position: number): void {
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

beforeEach(() => {
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

describe('useNextSlideLayer', () => {
  it('is empty with nothing live and nothing open', () => {
    const {result} = renderHook(() => useNextSlideLayer());
    expect(result.current).toBeNull();
  });

  it('is the first tile of the open item when nothing is live', () => {
    openItem('song-river');
    const {result} = renderHook(() => useNextSlideLayer());
    expect(result.current).toMatchObject({itemId: 'song-river', position: 0});
  });

  it('is the tile after the live one in the live item', () => {
    setLive('song-morning', 1);
    openItem('song-morning');
    const {result} = renderHook(() => useNextSlideLayer());
    expect(result.current).toMatchObject({itemId: 'song-morning', position: 2});
  });

  it('is empty after the last tile', () => {
    setLive('song-morning', 3);
    openItem('song-morning');
    const {result} = renderHook(() => useNextSlideLayer());
    expect(result.current).toBeNull();
  });

  it('follows the live 장 and the open item', () => {
    setLive('song-morning', 0);
    openItem('song-morning');
    const {result} = renderHook(() => useNextSlideLayer());
    expect(result.current).toMatchObject({position: 1});
    act(() => setLive('song-morning', 1));
    expect(result.current).toMatchObject({position: 2});
    act(() => openItem('song-river'));
    expect(result.current).toMatchObject({itemId: 'song-river', position: 0});
  });

  it('keeps the same object while nothing it depends on changes', () => {
    setLive('song-morning', 0);
    openItem('song-morning');
    const {result, rerender} = renderHook(() => useNextSlideLayer());
    const first = result.current;
    act(() => useShow.setState({selectedTile: 2}));
    rerender();
    expect(result.current).toBe(first);
  });
});
