import {describe, expect, it} from 'vitest';
import type {ItemId, ServiceRow, SlideTile} from './model';
import {
  moveRowSelection,
  moveTileSelection,
  nextTile,
  previousTile,
  tileForLabel,
  type SequenceState,
} from './navigation';

const rows: readonly ServiceRow[] = [
  {kind: 'header', id: 'h1', title: 'Before'},
  {kind: 'song', id: 'a', title: 'Song A'},
  {kind: 'slot', id: 'slot', title: 'Empty slot'},
  {kind: 'header', id: 'h2', title: 'Praise'},
  {kind: 'song', id: 'b', title: 'Song B'},
  {kind: 'bible', id: 'c', title: 'Passage C'},
];

function tile(label: string | null): SlideTile {
  return {label, labelColor: null, lines: ['line']};
}

const tiles: Readonly<Record<ItemId, readonly SlideTile[]>> = {
  a: [tile('Verse'), tile('Chorus'), tile('Verse'), tile('Chorus')],
  b: [tile('Verse'), tile(null)],
  c: [tile(null)],
  slot: [],
};

function stateOf(overrides: Partial<SequenceState>): SequenceState {
  return {
    rows,
    tilesOf: itemId => tiles[itemId] ?? [],
    live: null,
    openItemId: null,
    ...overrides,
  };
}

describe('moveRowSelection', () => {
  it('moves down and up between rows and skips headers', () => {
    expect(moveRowSelection(rows, 'slot', 'down')).toBe('b');
    expect(moveRowSelection(rows, 'b', 'up')).toBe('slot');
  });

  it('stops at both ends of the list', () => {
    expect(moveRowSelection(rows, 'a', 'up')).toBe('a');
    expect(moveRowSelection(rows, 'c', 'down')).toBe('c');
  });

  it('goes to the first and last row with Home and End', () => {
    expect(moveRowSelection(rows, 'b', 'home')).toBe('a');
    expect(moveRowSelection(rows, 'b', 'end')).toBe('c');
  });

  it('starts at the first row when nothing is selected and down is pressed', () => {
    expect(moveRowSelection(rows, null, 'down')).toBe('a');
    expect(moveRowSelection(rows, null, 'up')).toBeNull();
  });

  it('returns nothing for a list without selectable rows', () => {
    expect(moveRowSelection([], null, 'home')).toBeNull();
    expect(moveRowSelection(rows.slice(0, 1), null, 'down')).toBeNull();
  });
});

describe('moveTileSelection', () => {
  const grid = {count: 7, columns: 3};

  it('moves by one with left and right', () => {
    expect(moveTileSelection({...grid, index: 3, key: 'right'})).toBe(4);
    expect(moveTileSelection({...grid, index: 3, key: 'left'})).toBe(2);
  });

  it('moves by one row with up and down', () => {
    expect(moveTileSelection({...grid, index: 3, key: 'down'})).toBe(6);
    expect(moveTileSelection({...grid, index: 4, key: 'up'})).toBe(1);
  });

  it('stays on the first and last tile', () => {
    expect(moveTileSelection({...grid, index: 0, key: 'left'})).toBe(0);
    expect(moveTileSelection({...grid, index: 0, key: 'up'})).toBe(0);
    expect(moveTileSelection({...grid, index: 6, key: 'right'})).toBe(6);
    expect(moveTileSelection({...grid, index: 6, key: 'down'})).toBe(6);
  });

  it('does not move down past a short last row', () => {
    expect(moveTileSelection({...grid, index: 5, key: 'down'})).toBe(5);
  });

  it('returns 0 for an empty grid', () => {
    expect(
      moveTileSelection({count: 0, columns: 3, index: 0, key: 'right'}),
    ).toBe(0);
  });
});

describe('nextTile', () => {
  it('outputs the first tile of the open item when nothing is live', () => {
    expect(nextTile(stateOf({openItemId: 'b'}))).toEqual({
      itemId: 'b',
      index: 0,
    });
  });

  it('returns nothing without a live 장 and without an open item', () => {
    expect(nextTile(stateOf({}))).toBeNull();
  });

  it('returns nothing when the open item has no tiles', () => {
    expect(nextTile(stateOf({openItemId: 'slot'}))).toBeNull();
  });

  it('moves to the tile after the live one', () => {
    const live = {itemId: 'a', index: 1};
    expect(nextTile(stateOf({live}))).toEqual({itemId: 'a', index: 2});
  });

  it('moves from the last tile to the first tile of the next item that can output', () => {
    const live = {itemId: 'a', index: 3};
    expect(nextTile(stateOf({live}))).toEqual({itemId: 'b', index: 0});
  });

  it('skips headers and slots after the last tile', () => {
    const live = {itemId: 'a', index: 3};
    const next = nextTile(stateOf({live}));
    expect(next?.itemId).not.toBe('slot');
  });

  it('returns nothing after the last tile of the last item', () => {
    const live = {itemId: 'c', index: 0};
    expect(nextTile(stateOf({live}))).toBeNull();
  });

  it('uses the live item even when another item is open', () => {
    const live = {itemId: 'b', index: 0};
    expect(nextTile(stateOf({live, openItemId: 'a'}))).toEqual({
      itemId: 'b',
      index: 1,
    });
  });
});

describe('previousTile', () => {
  it('moves to the tile before the live one', () => {
    const live = {itemId: 'a', index: 2};
    expect(previousTile(stateOf({live}))).toEqual({itemId: 'a', index: 1});
  });

  it('does nothing on the first tile', () => {
    const live = {itemId: 'a', index: 0};
    expect(previousTile(stateOf({live}))).toBeNull();
  });

  it('does nothing without a live 장', () => {
    expect(previousTile(stateOf({openItemId: 'a'}))).toBeNull();
  });
});

describe('tileForLabel', () => {
  it('outputs the first tile with the label after the live 장', () => {
    const live = {itemId: 'a', index: 1};
    expect(tileForLabel(stateOf({live}), 'Chorus')).toEqual({
      itemId: 'a',
      index: 3,
    });
  });

  it('goes back to the first tile with the label when none follows', () => {
    const live = {itemId: 'a', index: 3};
    expect(tileForLabel(stateOf({live}), 'Chorus')).toEqual({
      itemId: 'a',
      index: 1,
    });
  });

  it('starts from the beginning of the open item when nothing is live', () => {
    expect(tileForLabel(stateOf({openItemId: 'a'}), 'Verse')).toEqual({
      itemId: 'a',
      index: 0,
    });
  });

  it('returns nothing when the label does not exist', () => {
    const live = {itemId: 'a', index: 0};
    expect(tileForLabel(stateOf({live}), 'Bridge')).toBeNull();
  });

  it('returns nothing without a live 장 and without an open item', () => {
    expect(tileForLabel(stateOf({}), 'Verse')).toBeNull();
  });
});
