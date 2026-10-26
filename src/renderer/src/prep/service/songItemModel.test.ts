import {describe, expect, it} from 'vitest';
import {editorSong} from '@renderer/prep/editor/editorFixture';
import {movedOrder, orderChips, withoutPosition} from './songItemModel';

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
});
