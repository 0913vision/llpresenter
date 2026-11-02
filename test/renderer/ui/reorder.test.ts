import {afterEach, describe, expect, it} from 'vitest';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {
  REORDER_THRESHOLD_PX,
  rowMoveDirection,
  stepMove,
} from '@renderer/ui/reorder';

const IDS = ['a', 'b', 'c'] as const;

describe('stepMove', () => {
  it('puts a row before the one above it, or before the one two below it', () => {
    expect(stepMove(IDS, 'b', 'up')).toEqual({before: 'a'});
    expect(stepMove(IDS, 'a', 'down')).toEqual({before: 'c'});
  });

  it('moves the next to last row to the end', () => {
    expect(stepMove(IDS, 'b', 'down')).toEqual({before: null});
  });

  it('answers nothing at the ends and for a row that is not listed', () => {
    expect(stepMove(IDS, 'a', 'up')).toBeUndefined();
    expect(stepMove(IDS, 'c', 'down')).toBeUndefined();
    expect(stepMove(IDS, 'z', 'up')).toBeUndefined();
  });
});

describe('rowMoveDirection', () => {
  function press(code: string, altKey: boolean): KeyboardEvent {
    return new KeyboardEvent('keydown', {code, altKey, bubbles: true});
  }

  it('reads Alt up and Alt down as the move keys', () => {
    expect(rowMoveDirection(press('ArrowUp', true))).toBe('up');
    expect(rowMoveDirection(press('ArrowDown', true))).toBe('down');
  });

  afterEach(() => commandBindingStore.set({}));

  it('lets the older binding keep a key that two move commands share', () => {
    commandBindingStore.set({
      'list.moveUp': [{code: 'ArrowDown', mods: ['alt']}],
    });

    expect(rowMoveDirection(press('ArrowDown', true))).toBe('down');
    expect(rowMoveDirection(press('ArrowUp', true))).toBeUndefined();
  });

  it('follows keys the operator set', () => {
    commandBindingStore.set({
      'list.moveUp': [{code: 'KeyK', mods: ['alt']}],
      'list.moveDown': [],
    });

    expect(rowMoveDirection(press('KeyK', true))).toBe('up');
    expect(rowMoveDirection(press('ArrowDown', true))).toBeUndefined();
  });

  it('leaves the plain arrows to the list', () => {
    expect(rowMoveDirection(press('ArrowUp', false))).toBeUndefined();
  });
});

it('starts a drag after four pixels in every list', () => {
  expect(REORDER_THRESHOLD_PX).toBe(4);
});
