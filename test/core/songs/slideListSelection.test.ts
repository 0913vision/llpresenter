import {describe, expect, it} from 'vitest';
import {
  emptySlideSelection,
  selectSlideList,
  slideInsertionIndex,
  type SlideListSelection,
  type SlideSelectionAction,
} from '@core/songs/slideListSelection';

const ids = ['a', 'b', 'c', 'd', 'e'];
function actions(...actions: ReadonlyArray<SlideSelectionAction<string>>) {
  return actions.reduce(
    (state, action) => selectSlideList(ids, state, action),
    emptySlideSelection<string>(),
  );
}
const selected = (state: SlideListSelection<string>) => [...state.ids];

describe('slide list selection', () => {
  it('clicks one slide, toggles independent slides, and remembers the last focus', () => {
    const state = actions(
      {type: 'click', id: 'b'},
      {type: 'click', id: 'd', ctrl: true},
      {type: 'click', id: 'b', ctrl: true},
    );
    expect(selected(state)).toEqual(['d']);
    expect(state.anchor).toEqual({kind: 'slide', id: 'b'});
    expect(state.focus).toEqual(state.anchor);
    expect(
      selected(selectSlideList(ids, state, {type: 'click', id: 'a'})),
    ).toEqual(['a']);
  });

  it('extends and contracts a range from the same slide anchor in either direction', () => {
    const state = actions(
      {type: 'click', id: 'c'},
      {type: 'click', id: 'e', shift: true},
      {type: 'click', id: 'b', shift: true},
    );
    expect(selected(state)).toEqual(['b', 'c']);
    expect(state.anchor).toEqual({kind: 'slide', id: 'c'});
    expect(state.focus).toEqual({kind: 'slide', id: 'b'});
  });

  it('uses the clicked slide as the anchor when Shift has no earlier anchor', () => {
    expect(selected(actions({type: 'click', id: 'd', shift: true}))).toEqual([
      'd',
    ]);
  });

  it('adds a Shift range with Ctrl instead of replacing the existing selection', () => {
    expect(
      selected(
        actions(
          {type: 'click', id: 'a'},
          {type: 'click', id: 'c', ctrl: true},
          {type: 'click', id: 'e', shift: true, ctrl: true},
        ),
      ),
    ).toEqual(['a', 'c', 'd', 'e']);
  });

  it('selects all and clears selection, focus, anchor, and caret', () => {
    const all = actions({type: 'all'});
    expect(selected(all)).toEqual(ids);
    expect(all.focus).toEqual({kind: 'slide', id: 'e'});
    expect(selectSlideList(ids, all, {type: 'clear'})).toEqual(
      emptySlideSelection(),
    );
  });

  it('clicks any gap including both ends and clears slide selection', () => {
    for (const index of [0, 2, ids.length]) {
      const state = actions({type: 'all'}, {type: 'gap', index});
      expect(selected(state)).toEqual([]);
      expect(state.caret).toBe(index);
      expect(state.focus).toEqual({kind: 'gap', index});
    }
  });

  it('moves and clamps the caret when no slide is selected', () => {
    const state = actions({type: 'gap', index: 2}, {type: 'arrow', delta: 1});
    expect(state.caret).toBe(3);
    expect(selectSlideList(ids, state, {type: 'arrow', delta: 99}).caret).toBe(
      5,
    );
    expect(selectSlideList(ids, state, {type: 'arrow', delta: -99}).caret).toBe(
      0,
    );
    expect(actions({type: 'arrow', delta: 1}).caret).toBe(1);
  });

  it('moves focus and replaces a selection with an ordinary arrow', () => {
    expect(
      selected(
        actions(
          {type: 'click', id: 'b'},
          {type: 'click', id: 'd', ctrl: true},
          {type: 'arrow', delta: -1},
        ),
      ),
    ).toEqual(['c']);
    expect(
      selected(actions({type: 'click', id: 'a'}, {type: 'arrow', delta: -1})),
    ).toEqual(['a']);
  });

  it('uses Shift arrows to extend and contract a slide range, including grid strides', () => {
    const state = actions(
      {type: 'click', id: 'b'},
      {type: 'arrow', delta: 3, shift: true},
      {type: 'arrow', delta: -2, shift: true},
    );
    expect(selected(state)).toEqual(['b', 'c']);
    expect(state.anchor).toEqual({kind: 'slide', id: 'b'});
  });

  it('extends from a gap and contracts back to its caret before crossing it', () => {
    let state = actions(
      {type: 'gap', index: 2},
      {type: 'arrow', delta: 1, shift: true},
    );
    expect(selected(state)).toEqual(['c']);
    expect(state.caret).toBeNull();
    state = selectSlideList(ids, state, {
      type: 'arrow',
      delta: -1,
      shift: true,
    });
    expect(selected(state)).toEqual([]);
    expect(state.caret).toBe(2);
    state = selectSlideList(ids, state, {
      type: 'arrow',
      delta: -2,
      shift: true,
    });
    expect(selected(state)).toEqual(['a', 'b']);
  });

  it('selects the clicked side of a gap with Shift click', () => {
    expect(
      selected(
        actions({type: 'gap', index: 2}, {type: 'click', id: 'd', shift: true}),
      ),
    ).toEqual(['c', 'd']);
    expect(
      selected(
        actions({type: 'gap', index: 2}, {type: 'click', id: 'a', shift: true}),
      ),
    ).toEqual(['a', 'b']);
  });

  it('moves from the focused slide when leaving a gap-based range without Shift', () => {
    expect(
      selected(
        actions(
          {type: 'gap', index: 2},
          {type: 'arrow', delta: 1, shift: true},
          {type: 'arrow', delta: -1},
        ),
      ),
    ).toEqual(['b']);
    expect(
      selected(
        actions(
          {type: 'gap', index: 2},
          {type: 'arrow', delta: -1, shift: true},
          {type: 'arrow', delta: 1},
        ),
      ),
    ).toEqual(['c']);
  });

  it('handles an empty list and Shift before any click', () => {
    expect(selected(actions({type: 'arrow', delta: 1, shift: true}))).toEqual([
      'a',
    ]);
    for (const action of [
      {type: 'all'},
      {type: 'arrow', delta: 1},
      {type: 'gap', index: 0},
    ] as const) {
      const state = selectSlideList([], emptySlideSelection(), action);
      expect(state.ids.size).toBe(0);
      expect(state.caret).toBe(0);
    }
  });

  it('ignores unknown slides, invalid gaps and invalid arrow deltas', () => {
    const state = actions({type: 'click', id: 'b'});
    for (const action of [
      {type: 'click', id: 'missing'},
      {type: 'gap', index: -1},
      {type: 'gap', index: 6},
      {type: 'gap', index: 0.5},
      {type: 'arrow', delta: NaN},
      {type: 'arrow', delta: 0},
    ] as const) {
      expect(selectSlideList(ids, state, action)).toBe(state);
    }
  });

  it('pastes at the caret, after the last selected in deck order, or at the end', () => {
    expect(slideInsertionIndex(ids, actions({type: 'gap', index: 0}))).toBe(0);
    expect(
      slideInsertionIndex(
        ids,
        actions({type: 'click', id: 'd'}, {type: 'click', id: 'a', ctrl: true}),
      ),
    ).toBe(4);
    expect(slideInsertionIndex(ids, emptySlideSelection())).toBe(5);
  });
});
