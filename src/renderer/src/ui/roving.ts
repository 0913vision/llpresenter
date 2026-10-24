import {useRef, type KeyboardEvent} from 'react';
import {hasModifier} from './modifierKeys';

/** A move within a group where only one item takes the Tab stop. */
export type RovingMove = 'next' | 'previous' | 'first' | 'last';

const keyMoves: Readonly<Record<string, RovingMove>> = {
  ArrowRight: 'next',
  ArrowLeft: 'previous',
  Home: 'first',
  End: 'last',
};

function firstEnabled(
  enabled: readonly boolean[],
  start: number,
  direction: 1 | -1,
): number | undefined {
  const count = enabled.length;
  for (let offset = 0; offset < count; offset++) {
    const index = (((start + direction * offset) % count) + count) % count;
    if (enabled[index] === true) return index;
  }
  return undefined;
}

/**
 * Returns the index that a move from `from` lands on, wrapping around the ends
 * and skipping disabled items, or `undefined` when no item is enabled.
 */
export function rovingTarget(
  enabled: readonly boolean[],
  from: number,
  move: RovingMove,
): number | undefined {
  switch (move) {
    case 'next':
      return firstEnabled(enabled, from + 1, 1);
    case 'previous':
      return firstEnabled(enabled, from - 1, -1);
    case 'first':
      return firstEnabled(enabled, 0, 1);
    case 'last':
      return firstEnabled(enabled, enabled.length - 1, -1);
  }
}

/** The index that takes the Tab stop: the selected item, else the first enabled. */
export function rovingTabStop(
  enabled: readonly boolean[],
  selected: number,
): number {
  if (selected >= 0) return selected;
  return firstEnabled(enabled, 0, 1) ?? 0;
}

export interface RovingItem<T> {
  readonly value: T;
  readonly disabled?: boolean | undefined;
}

export interface RovingSelectionOptions<T> {
  readonly items: ReadonlyArray<RovingItem<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Turns off every move, for a group that is disabled as a whole. */
  readonly disabled: boolean;
}

export interface RovingSelection {
  readonly tabIndexOf: (index: number) => 0 | -1;
  readonly refOf: (index: number) => (element: HTMLElement | null) => void;
  readonly onKeyDown: (index: number, event: KeyboardEvent) => void;
}

/**
 * Keyboard selection for a one-of-several group: Left and Right move and
 * select at once, Home and End go to the ends, and Tab stops only on the
 * selected item.
 */
export function useRovingSelection<T>({
  items,
  value,
  onChange,
  disabled,
}: RovingSelectionOptions<T>): RovingSelection {
  const elements = useRef<Array<HTMLElement | null>>([]);
  const enabled = items.map(item => !disabled && item.disabled !== true);
  const tabStop = rovingTabStop(
    enabled,
    items.findIndex(item => item.value === value),
  );

  const onKeyDown = (index: number, event: KeyboardEvent): void => {
    const move = keyMoves[event.key];
    if (move === undefined || hasModifier(event)) return;
    event.preventDefault();
    const target = rovingTarget(enabled, index, move);
    if (target === undefined) return;
    elements.current[target]?.focus();
    const item = items[target];
    if (item !== undefined && item.value !== value) onChange(item.value);
  };

  return {
    tabIndexOf: index => (index === tabStop ? 0 : -1),
    refOf: index => element => {
      elements.current[index] = element;
    },
    onKeyDown,
  };
}
