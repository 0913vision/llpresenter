import type {MouseEvent, MouseEventHandler} from 'react';

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
