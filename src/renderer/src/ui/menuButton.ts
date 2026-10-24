import type {KeyboardEvent, MouseEventHandler} from 'react';
import {pressHandler} from './press';

const OPEN_KEY = 'ArrowDown';

/** The open state of a button that opens a menu or a list. */
export interface MenuButtonState {
  /** Whether the menu or list that the button opens is open. */
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly disabled?: boolean | undefined;
}

/** The props that make a button open a menu. */
export interface MenuButtonProps {
  readonly 'aria-haspopup': 'menu';
  readonly 'aria-expanded': boolean;
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Opens the menu on ↓ while it is closed, as the Menu README asks. Enter and
 * Space press the button itself, so they need nothing here.
 */
export function openOnArrowDown(
  event: KeyboardEvent,
  {expanded, onExpandedChange, disabled = false}: MenuButtonState,
): void {
  if (event.defaultPrevented || disabled || event.key !== OPEN_KEY) return;
  event.preventDefault();
  if (!expanded) onExpandedChange(true);
}

/**
 * The props for any button that opens a menu: the popup state for assistive
 * technology, a click that opens and closes it, and ↓ that opens it. An
 * `IconButton` draws the popup state from its own `menu` and `expanded`
 * props, so pass those as well.
 *
 * @example
 * ```tsx
 * <IconButton
 *   icon="more"
 *   label="더 보기"
 *   menu
 *   expanded={open}
 *   {...menuButtonProps({expanded: open, onExpandedChange: setOpen})}
 * />
 * ```
 */
export function menuButtonProps(state: MenuButtonState): MenuButtonProps {
  const {expanded, onExpandedChange, disabled = false} = state;
  return {
    'aria-haspopup': 'menu',
    'aria-expanded': expanded,
    onClick: pressHandler(disabled, () => onExpandedChange(!expanded)),
    onKeyDown: event => openOnArrowDown(event, state),
  };
}
