import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {usePrepSelection} from '@renderer/app/usePrepSelection';

const SONG = createSongId('00000000-0000-4000-8000-000000000001');

describe('usePrepSelection', () => {
  it('holds one request until the library handles it, so it is never replayed', () => {
    const {result} = renderHook(() => usePrepSelection());

    act(() => result.current.openSong(SONG, 2));
    const request = result.current.request;
    expect(request).toEqual({kind: 'open', songId: SONG, position: 2});
    act(() => {
      if (request) result.current.handled(request);
    });
    expect(result.current.request).toBeUndefined();

    act(() => result.current.clear());
    const clear = result.current.request;
    act(() => result.current.openSong(SONG));
    act(() => {
      if (clear) result.current.handled(clear);
    });
    expect(result.current.request).toEqual({
      kind: 'open',
      songId: SONG,
      position: undefined,
    });
  });
});
