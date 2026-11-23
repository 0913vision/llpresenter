import {describe, expect, it} from 'vitest';
import {
  gridRange,
  listKeyTarget,
  optionKeyTarget,
  rowRange,
  scrollIntoBand,
} from '@renderer/ui/useRowRange';

const options = {initialRows: 4, overscan: 2};

describe('the rows a long list mounts', () => {
  it('mounts the first rows before the list was measured', () => {
    expect(rowRange({top: 0, height: 0, row: 0}, 100, options)).toEqual({
      start: 0,
      end: 8,
    });
  });

  it('mounts the rows on screen and two more on each side', () => {
    expect(rowRange({top: 400, height: 200, row: 40}, 100, options)).toEqual({
      start: 8,
      end: 17,
    });
  });

  it('stays inside a short list and at its end', () => {
    expect(rowRange({top: 0, height: 400, row: 40}, 3, options)).toEqual({
      start: 0,
      end: 3,
    });
    expect(rowRange({top: 3800, height: 200, row: 40}, 100, options)).toEqual({
      start: 93,
      end: 100,
    });
  });
});

describe('the row a list key moves to', () => {
  it('moves one row with the arrows and to the ends with Home and End', () => {
    expect(listKeyTarget('ArrowDown', 3, 10)).toBe(4);
    expect(listKeyTarget('ArrowUp', 3, 10)).toBe(2);
    expect(listKeyTarget('Home', 3, 10)).toBe(0);
    expect(listKeyTarget('End', 3, 10)).toBe(9);
  });

  it('stops at the ends and ignores other keys and empty lists', () => {
    expect(listKeyTarget('ArrowDown', 9, 10)).toBe(9);
    expect(listKeyTarget('ArrowUp', 0, 10)).toBe(0);
    expect(listKeyTarget('ArrowUp', -1, 10)).toBe(0);
    expect(listKeyTarget('Enter', 3, 10)).toBeUndefined();
    expect(listKeyTarget('ArrowDown', 0, 0)).toBeUndefined();
  });
});

describe('the tiles a long grid mounts', () => {
  it('mounts whole rows of tiles near the screen', () => {
    expect(
      gridRange({top: 400, height: 200, row: 100}, 50, {
        ...options,
        columns: 3,
      }),
    ).toEqual({start: 6, end: 24});
  });

  it('ends at the last tile of a row that is not full', () => {
    expect(
      gridRange({top: 0, height: 1000, row: 100}, 7, {...options, columns: 3}),
    ).toEqual({start: 0, end: 7});
  });
});

describe('the option a list box key moves to', () => {
  function list(): HTMLElement {
    const box = document.createElement('div');
    for (const id of ['a', 'b', 'c']) {
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      option.dataset['value'] = id;
      box.append(option);
    }
    return box;
  }
  const keys = {altKey: false, ctrlKey: false, metaKey: false, shiftKey: false};

  it('moves from the focused option before the selected one', () => {
    const box = list();
    const target = box.querySelector('[data-value="b"]');
    if (target === null) throw new Error('Missing option');
    expect(
      optionKeyTarget(
        {...keys, key: 'ArrowDown', target},
        ['a', 'b', 'c'],
        'a',
      ),
    ).toEqual({index: 2, id: 'c'});
    expect(
      optionKeyTarget(
        {...keys, key: 'ArrowUp', target: box},
        ['a', 'b', 'c'],
        'c',
      ),
    ).toEqual({index: 1, id: 'b'});
  });

  it('leaves keys with a modifier and keys typed in a field', () => {
    const field = document.createElement('input');
    expect(
      optionKeyTarget(
        {...keys, shiftKey: true, key: 'ArrowDown', target: list()},
        ['a', 'b'],
        'a',
      ),
    ).toBeUndefined();
    expect(
      optionKeyTarget({...keys, key: 'End', target: field}, ['a', 'b'], 'a'),
    ).toBeUndefined();
  });
});

describe('scrolling a row into view', () => {
  function viewport(scrollTop: number): HTMLElement {
    const node = document.createElement('div');
    Object.defineProperty(node, 'clientHeight', {value: 200});
    node.scrollTop = scrollTop;
    return node;
  }

  it('scrolls the least that shows the row', () => {
    const below = viewport(0);
    expect(scrollIntoBand(below, 400, 40)).toBe(true);
    expect(below.scrollTop).toBe(240);
    const above = viewport(300);
    expect(scrollIntoBand(above, 120, 40)).toBe(true);
    expect(above.scrollTop).toBe(120);
  });

  it('leaves a row that is on screen', () => {
    const shown = viewport(100);
    expect(scrollIntoBand(shown, 160, 40)).toBe(false);
    expect(shown.scrollTop).toBe(100);
  });
});
