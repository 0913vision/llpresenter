import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createSlideId} from '@core/schema/ids';
import {useLive} from '@renderer/session/live';
import {useEditorLiveIndex} from '@renderer/features/songs/editor/useEditorLiveIndex';

afterEach(() => useLive.setState({state: null}));

it('matches the live source and stable slide after a reorder, and clears a removed slide', () => {
  const first = {id: createSlideId('00000000-0000-4000-8000-000000000001')};
  const second = {id: createSlideId('00000000-0000-4000-8000-000000000002')};
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        slide: {
          itemId: 'editor-item',
          position: 0,
          sourceSlideId: first.id,
          label: null,
          lines: [],
        },
      },
    },
  });
  const {result, rerender} = renderHook(
    ({source, slides}) => useEditorLiveIndex(source, slides),
    {initialProps: {source: 'editor-item', slides: [first, second]}},
  );
  expect(result.current).toBe(0);
  rerender({source: 'editor-item', slides: [second, first]});
  expect(result.current).toBe(1);
  rerender({source: 'other-item', slides: [first, second]});
  expect(result.current).toBeUndefined();
  rerender({source: 'editor-item', slides: [second]});
  expect(result.current).toBeUndefined();
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId: 'editor-item',
            position: 0,
            label: null,
            lines: [],
          },
        },
      },
    }),
  );
  expect(result.current).toBe(0);
  act(() => useLive.setState({state: null}));
  expect(result.current).toBeUndefined();
});
