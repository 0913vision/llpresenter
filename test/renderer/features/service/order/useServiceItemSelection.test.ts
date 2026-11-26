import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {useServiceItemSelection} from '@renderer/features/service/order/useServiceItemSelection';

const IDS = ['a', 'b', 'c'];

function setup() {
  const onSelect = vi.fn();
  const view = renderHook(
    ({cursor}: {cursor: string | null}) =>
      useServiceItemSelection({serviceId: 's', cursor, ids: IDS, onSelect}),
    {initialProps: {cursor: 'a'}},
  );
  return {view, onSelect};
}

it('keeps the chosen row while it is still opening, so a key pressed meanwhile acts on it', () => {
  const {view, onSelect} = setup();
  act(() => view.result.current.replace(['b'], 'b'));
  expect(onSelect).toHaveBeenCalledWith('b');
  expect([...view.result.current.selected]).toEqual(['b']);
  view.rerender({cursor: 'b'});
  expect([...view.result.current.selected]).toEqual(['b']);
});

it('starts anew when something else opens another item', () => {
  const {view} = setup();
  act(() => view.result.current.replace(['b'], 'b'));
  view.rerender({cursor: 'c'});
  expect([...view.result.current.selected]).toEqual(['c']);
});
