import {describe, expect, it} from 'vitest';
import {
  editorGroupedSong,
  editorSong,
} from '@renderer/prep/editor/editorFixture';
import {createSongGroupId, createSongId} from '@shared/schema/ids';
import type {GroupedSong} from '@shared/schema/groupedSong';
import {
  chipIndexForSlide,
  editedGroupOrder,
  groupStartIndices,
  groupStartIndicesFromGroups,
  itemPicture,
  movedOrder,
  orderChips,
  sameSequence,
  shownPosition,
  withoutPosition,
} from './songItemModel';

const {song} = editorSong(1);

describe('song item model', () => {
  it('keys repeated 슬라이드 by occurrence and colors them by 이름표', () => {
    expect(
      orderChips(song, [2, 1, 2], [{name: '후렴', color: 'orange', key: null}]),
    ).toEqual([
      {key: '2:1', name: '후렴', color: 'orange', number: 2},
      {key: '1:1', name: '1절', color: 'none', number: 1},
      {key: '2:2', name: '후렴', color: 'orange', number: 2},
    ]);
  });

  it('names a 슬라이드 without an 이름표 by its number only', () => {
    const unlabeled = {
      ...song,
      slides: [{lines: ['A']}, {label: '', lines: []}],
    };
    expect(orderChips(unlabeled, [1, 2], []).map(chip => chip.name)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('moves and removes positions without changing the input', () => {
    const order = [1, 2, 3];
    expect(movedOrder(order, 0, 2)).toEqual([2, 3, 1]);
    expect(movedOrder(order, 2, 0)).toEqual([3, 1, 2]);
    expect(withoutPosition(order, 1)).toEqual([1, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('clamps the selected place to the order', () => {
    expect(shownPosition(5, 3)).toBe(2);
    expect(shownPosition(1, 3)).toBe(1);
    expect(shownPosition(0, 0)).toBeUndefined();
  });

  it('pictures the selected place of the order the item plays', () => {
    expect(
      itemPicture({song, arrangement: '주일용', position: 2, background: 'bg'}),
    ).toEqual({song, block: 1, background: 'bg', position: 3, total: 3});
    expect(
      itemPicture({
        song,
        arrangement: undefined,
        position: 9,
        background: undefined,
      }),
    ).toMatchObject({block: 1, position: 2, total: 2});
    const empty = {...song, arrangements: [{name: '빈 구성', slides: []}]};
    expect(
      itemPicture({
        song: empty,
        arrangement: '빈 구성',
        position: 0,
        background: undefined,
      }),
    ).toMatchObject({block: 0, total: 2});
    expect(
      itemPicture({
        song: {...song, slides: []},
        arrangement: undefined,
        position: 0,
        background: undefined,
      }),
    ).toBeNull();
  });

  it('keys repeated groups in grouped songs and colors them by label', () => {
    const grouped = editorGroupedSong(1).song;
    const g1 = grouped.groups[0]?.id ?? createSongGroupId('1');
    const g2 = grouped.groups[1]?.id ?? createSongGroupId('2');
    expect(
      orderChips(
        grouped,
        [g1, g2, g1],
        [
          {name: '1절', color: 'teal', key: null},
          {name: '후렴', color: 'orange', key: null},
        ],
      ),
    ).toEqual([
      {key: `${g1}:1`, name: '1절', color: 'teal', number: 1},
      {key: `${g2}:1`, name: '후렴', color: 'orange', number: 2},
      {key: `${g1}:2`, name: '1절', color: 'teal', number: 1},
    ]);
  });

  it('names unnamed groups in grouped songs by their 1-based position', () => {
    const g1 = createSongGroupId('11111111-1111-4111-a111-111111111111');
    const grouped: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: createSongId('00000000-0000-4000-8000-000000000001'),
      title: '무제 곡',
      groups: [{id: g1, name: '', slides: [{lines: ['가사']}]}],
    };
    expect(orderChips(grouped, [g1], [])).toEqual([
      {key: `${g1}:1`, name: '이름표 없음 1', color: 'none', number: 1},
    ]);
  });

  it('computes group start indices and maps slide indices to chip index', () => {
    const grouped = editorGroupedSong(1).song;
    expect(editedGroupOrder(grouped, '주일용')).toEqual(
      grouped.arrangements?.[0]?.groups,
    );
    const starts = groupStartIndices(grouped, '주일용');
    expect(starts).toEqual([0, 2, 3]);
    expect(
      groupStartIndicesFromGroups(grouped, [
        grouped.groups[0]?.id ?? createSongGroupId('1'),
      ]),
    ).toEqual([0]);

    expect(chipIndexForSlide(0, starts, 5)).toBe(0);
    expect(chipIndexForSlide(1, starts, 5)).toBe(0);
    expect(chipIndexForSlide(2, starts, 5)).toBe(1);
    expect(chipIndexForSlide(3, starts, 5)).toBe(2);
    expect(chipIndexForSlide(4, starts, 5)).toBe(2);

    expect(chipIndexForSlide(undefined, starts, 5)).toBeUndefined();
    expect(chipIndexForSlide(-1, starts, 5)).toBeUndefined();
    expect(chipIndexForSlide(5, starts, 5)).toBeUndefined();
  });

  it('compares sequences with sameSequence', () => {
    expect(sameSequence([1, 2], [1, 2])).toBe(true);
    expect(sameSequence(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSequence(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameSequence(['a'], ['a', 'b'])).toBe(false);
  });

  it('pictures grouped song item with arrangement', () => {
    const grouped = editorGroupedSong(1).song;
    expect(
      itemPicture({
        song: grouped,
        arrangement: '주일용',
        position: 1,
        background: 'bg',
      }),
    ).toEqual({
      song: grouped,
      block: 1,
      background: 'bg',
      position: 2,
      total: 5,
    });
  });
});
