import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import type {MediaEntry} from '@renderer/features/media/mediaEntries';
import {useMediaPicks} from '@renderer/features/media/tiles/useMediaPicks';

const IDS = ['a', 'b', 'c', 'd', 'e'];
const ENTRIES: readonly MediaEntry[] = IDS.map((id, index) => ({
  id,
  kind: 'copy',
  job: {
    mediaId: createMediaId(`00000000-0000-4000-8000-00000000070${index}`),
    fileName: `${id}.mp4`,
    phase: 'queued',
    percent: 0,
  },
}));

function setUp(selected: string | null) {
  const setSelected = vi.fn<(id: string | null) => void>();
  const view = renderHook(
    ({chosen}: {chosen: string | null}) =>
      useMediaPicks({entries: ENTRIES, selected: chosen, setSelected}),
    {initialProps: {chosen: selected}},
  );
  return {view, setSelected};
}

function chosen(view: ReturnType<typeof setUp>['view']): string[] {
  return IDS.filter(id => view.result.current.isChosen(id));
}

it('takes the range from the selected tile with Shift', () => {
  const {view, setSelected} = setUp('b');
  act(() => view.result.current.pick(3, true));
  expect(chosen(view)).toEqual(['b', 'c', 'd']);
  expect(setSelected).not.toHaveBeenCalled();
  act(() => view.result.current.pick(0, true));
  expect(chosen(view)).toEqual(['a', 'b']);
});

it('starts a Shift range at the tile itself when none is selected, and selects it', () => {
  const {view, setSelected} = setUp(null);
  act(() => view.result.current.pick(2, true));
  expect(chosen(view)).toEqual(['c']);
  expect(setSelected).toHaveBeenCalledWith('c');
});

it('adds and takes tiles with Ctrl, starting from the selected one', () => {
  const {view, setSelected} = setUp('a');
  act(() => view.result.current.pick(2, false));
  expect(chosen(view)).toEqual(['a', 'c']);
  expect(setSelected).toHaveBeenLastCalledWith('c');
  act(() => view.result.current.pick(0, false));
  expect(chosen(view)).toEqual(['c']);
});

it('selects one tile alone, clears the picks, and ignores a place with no tile', () => {
  const {view, setSelected} = setUp('a');
  act(() => view.result.current.pick(1, false));
  act(() => view.result.current.select('e'));
  expect(setSelected).toHaveBeenLastCalledWith('e');
  expect(view.result.current.picked.size).toBe(0);
  act(() => view.result.current.pick(9, false));
  expect(view.result.current.picked.size).toBe(0);
  view.rerender({chosen: 'd'});
  expect(view.result.current.index).toBe(3);
  act(() => view.result.current.pick(4, false));
  act(() => view.result.current.clear());
  expect(chosen(view)).toEqual(['d']);
});
