import type {
  KeyboardEvent,
  KeyboardEventHandler,
  MouseEvent,
  MouseEventHandler,
} from 'react';

/**
 * Returns a click handler that ignores presses while the control is disabled.
 *
 * @param disabled - Whether the control is disabled.
 * @param onPress - The handler to call for presses on an enabled control.
 */
export function pressHandler<T extends Element>(
  disabled: boolean,
  onPress: MouseEventHandler<T> | undefined,
): MouseEventHandler<T> {
  // NOTE(0913vision): Disabled controls use aria-disabled instead of the
  // disabled attribute so that they stay focusable and keep their tooltip,
  // which means the browser still delivers their clicks.
  return (event: MouseEvent<T>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onPress?.(event);
  };
}

/**
 * Returns a key handler for a checkbox or switch, which toggles only on Space.
 *
 * @param onKeyDown - The caller's own key handler, called first.
 */
export function spaceOnlyKeyHandler<T extends Element>(
  onKeyDown: KeyboardEventHandler<T> | undefined,
): KeyboardEventHandler<T> {
  // NOTE(0913vision): A native button presses on Enter, but checkboxes and
  // switches toggle only on Space, and Enter belongs to the dialog's primary
  // button.
  return (event: KeyboardEvent<T>) => {
    onKeyDown?.(event);
    if (event.key === 'Enter') event.preventDefault();
  };
}
