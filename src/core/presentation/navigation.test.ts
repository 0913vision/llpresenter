import {describe, expect, it} from 'vitest';
import type {ItemId, ServiceRow, SlideTile} from './model';
import {
  adjacentItem,
  liveItem,
  nextTile,
  previousTile,
  type SequenceState,
} from './navigation';

const rows: readonly ServiceRow[] = [
  {kind: 'header', id: 'h1', title: 'Before'},
  {kind: 'song', id: 'a', title: 'Song A'},
  {kind: 'header', id: 'empty-section', title: 'Empty section'},
  {kind: 'header', id: 'h2', title: 'Praise'},
  {kind: 'song', id: 'b', title: 'Song B'},
  {kind: 'bible', id: 'c', title: 'Passage C'},
];

function tile(label: string | null): SlideTile {
  return {label, labelColor: 'none', lines: ['line']};
}

const tiles: Readonly<Record<ItemId, readonly SlideTile[]>> = {
  a: [tile('Verse'), tile('Chorus'), tile('Verse'), tile('Chorus')],
  b: [tile('Verse'), tile(null)],
  c: [tile(null)],
};

function stateOf(overrides: Partial<SequenceState>): SequenceState {
  return {
    tilesOf: itemId => tiles[itemId] ?? [],
    live: null,
    openItemId: null,
    ...overrides,
  };
}

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
    expect(nextTile(stateOf({openItemId: 'empty-section'}))).toBeNull();
  });

  it('moves to the tile after the live one', () => {
    const live = {itemId: 'a', index: 1};
    expect(nextTile(stateOf({live}))).toEqual({itemId: 'a', index: 2});
  });

  it('stops at the last tile and does not move on to the next item', () => {
    expect(nextTile(stateOf({live: {itemId: 'a', index: 3}}))).toBeNull();
    expect(nextTile(stateOf({live: {itemId: 'c', index: 0}}))).toBeNull();
  });

  it('outputs the first tile of another open item instead of following the live one', () => {
    const live = {itemId: 'b', index: 0};
    expect(nextTile(stateOf({live, openItemId: 'a'}))).toEqual({
      itemId: 'a',
      index: 0,
    });
  });

  it('follows the live item when it is the open one', () => {
    const live = {itemId: 'b', index: 0};
    expect(nextTile(stateOf({live, openItemId: 'b'}))).toEqual({
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

describe('adjacentItem', () => {
  const find = (current: ItemId | null, direction: 'next' | 'previous') =>
    adjacentItem({rows, tilesOf: stateOf({}).tilesOf, current, direction});

  it('gives the next item that can output and skips sections', () => {
    expect(find('a', 'next')).toBe('b');
  });

  it('gives the previous item that can output and skips sections', () => {
    expect(find('b', 'previous')).toBe('a');
    expect(find('c', 'previous')).toBe('b');
  });

  it('navigates in both directions from a selected empty section', () => {
    expect(find('empty-section', 'next')).toBe('b');
    expect(find('empty-section', 'previous')).toBe('a');
  });

  it('skips an item without a 장', () => {
    const withEmpty: readonly ServiceRow[] = [
      {kind: 'song', id: 'a', title: 'A'},
      {kind: 'song', id: 'empty', title: 'Missing song'},
      {kind: 'song', id: 'b', title: 'B'},
    ];
    const tilesOf = stateOf({}).tilesOf;
    expect(
      adjacentItem({rows: withEmpty, tilesOf, current: 'a', direction: 'next'}),
    ).toBe('b');
    expect(
      adjacentItem({
        rows: withEmpty,
        tilesOf,
        current: 'b',
        direction: 'previous',
      }),
    ).toBe('a');
  });

  it('gives nothing at the ends of the list', () => {
    expect(find('c', 'next')).toBeNull();
    expect(find('a', 'previous')).toBeNull();
  });

  it('opens the first item with next and nothing with previous when no item is open', () => {
    expect(find(null, 'next')).toBe('a');
    expect(find(null, 'previous')).toBeNull();
  });

  it('gives nothing for an item that is not in the list', () => {
    expect(find('gone', 'next')).toBeNull();
    expect(find('gone', 'previous')).toBeNull();
  });

  it('gives nothing for a list without an item that can output', () => {
    const none: readonly ServiceRow[] = [
      {kind: 'header', id: 'h', title: 'H'},
      {kind: 'header', id: 'empty', title: 'Empty section'},
    ];
    expect(
      adjacentItem({
        rows: none,
        tilesOf: stateOf({}).tilesOf,
        current: null,
        direction: 'next',
      }),
    ).toBeNull();
  });
});

describe('liveItem', () => {
  it('gives the item of the live 장 when another item is open or none is', () => {
    expect(liveItem({rows, live: {itemId: 'b', index: 0}, current: 'a'})).toBe(
      'b',
    );
    expect(liveItem({rows, live: {itemId: 'b', index: 0}, current: null})).toBe(
      'b',
    );
  });

  it('gives nothing when the live item is already open', () => {
    expect(
      liveItem({rows, live: {itemId: 'b', index: 1}, current: 'b'}),
    ).toBeNull();
  });

  it('gives nothing without a live 장 or when its item is not in the list', () => {
    expect(liveItem({rows, live: null, current: 'a'})).toBeNull();
    expect(
      liveItem({rows, live: {itemId: 'gone', index: 0}, current: 'a'}),
    ).toBeNull();
  });
});
