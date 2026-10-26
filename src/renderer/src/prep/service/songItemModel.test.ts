import {describe, expect, it} from 'vitest';
import {editorSong} from '@renderer/prep/editor/editorFixture';
import {
  itemPicture,
  movedOrder,
  orderChips,
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
});
