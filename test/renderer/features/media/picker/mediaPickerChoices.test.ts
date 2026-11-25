import {describe, expect, it} from 'vitest';
import {
  choiceLabel,
  isChosenChoice,
  pickerChoices,
  pickerRowTop,
  searchName,
} from '@renderer/features/media/picker/mediaPickerChoices';

function image(id: string, name: string) {
  return {
    id,
    name,
    kind: 'image' as const,
  };
}
const specials = {
  allowNone: true,
  defaultChoice: {label: '테마 배경', detail: '테마가 정한 배경'},
};

describe('the rows of the media picker', () => {
  it('lists the default, the leading group, then the other items', () => {
    const {choices, groups, specialCount} = pickerChoices({
      items: [image('b', '바다'), {id: 'c', name: '찬양', kind: 'audio'}],
      leadingGroup: {label: '채우기', items: [image('a', '검정')]},
      itemsLabel: '미디어',
      query: '',
      specials,
    });
    expect(choices.map(choice => choice?.id)).toEqual([undefined, 'a', 'b']);
    expect(specialCount).toBe(1);
    expect(groups).toEqual([
      {index: 1, label: '채우기'},
      {index: 2, label: '미디어'},
    ]);
  });

  it('keeps only the names that hold the search and tells whether one did', () => {
    const rows = (query: string) =>
      pickerChoices({
        items: [image('b', '바다'), image('d', '바람')],
        query,
        specials,
      });
    expect(rows('바다').choices.map(choice => choice?.id)).toEqual([
      undefined,
      'b',
    ]);
    expect(rows('바다').found).toBe(true);
    expect(rows('산').found).toBe(false);
    expect(rows('').found).toBe(false);
  });

  it('names and checks the default, 없음 and an item', () => {
    const explicit = {...specials, explicitNone: {selected: true}};
    expect(choiceLabel(undefined, specials)).toBe('테마 배경');
    expect(choiceLabel(null, specials)).toBe('없음');
    expect(isChosenChoice(null, undefined, explicit)).toBe(true);
    expect(isChosenChoice(undefined, undefined, explicit)).toBe(false);
    expect(isChosenChoice(image('b', '바다'), 'b', specials)).toBe(true);
  });
});

describe('searchName', () => {
  it('compares names without case, outer spaces, or decomposed Hangul', () => {
    expect(searchName('  Dawn Sky ')).toBe('dawn sky');
    expect(searchName('각')).toBe(searchName('각'));
  });
});

describe('pickerRowTop', () => {
  const layout = {row: 28, gap: 9, specialCount: 2, groups: [{index: 2}]};

  it('puts the special rows first, then the divider, then each group under its heading', () => {
    expect(pickerRowTop(0, layout)).toBe(0);
    expect(pickerRowTop(1, layout)).toBe(28);
    expect(pickerRowTop(2, layout)).toBe(2 * 28 + 9 + 28);
    expect(pickerRowTop(3, layout)).toBe(3 * 28 + 9 + 28);
  });

  it('counts only the rows when no divider is drawn and there are no groups', () => {
    expect(
      pickerRowTop(3, {row: 28, gap: 0, specialCount: 0, groups: []}),
    ).toBe(3 * 28);
  });
});
