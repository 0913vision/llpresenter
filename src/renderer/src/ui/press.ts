import {
  useRef,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type MouseEvent,
  type MouseEventHandler,
} from 'react';
import {hasModifier} from './modifierKeys';

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

/** Pass modified activation keys on without allowing a native button press. */
export function useButtonPress<T extends Element>({
  disabled,
  onPress,
  onKeyDown,
  onKeyUp,
  onBlur,
  spaceOnly = false,
}: {
  readonly disabled: boolean;
  readonly onPress: MouseEventHandler<T> | undefined;
  readonly onKeyDown?: KeyboardEventHandler<T> | undefined;
  readonly onKeyUp?: KeyboardEventHandler<T> | undefined;
  readonly onBlur?: FocusEventHandler<T> | undefined;
  readonly spaceOnly?: boolean | undefined;
}): {
  readonly onClick: MouseEventHandler<T>;
  readonly onKeyDown: KeyboardEventHandler<T>;
  readonly onKeyUp: KeyboardEventHandler<T>;
  readonly onBlur: FocusEventHandler<T>;
} {
  const pending = useRef({modified: false, version: 0});
  return {
    onKeyDown: event => {
      onKeyDown?.(event);
      if (event.key === ' ' || (!spaceOnly && event.key === 'Enter')) {
        pending.current.version++;
        pending.current.modified =
          !event.defaultPrevented && hasModifier(event);
      }
      // NOTE(0913vision): Enter belongs to the dialog's primary action.
      if (spaceOnly && event.key === 'Enter') event.preventDefault();
    },
    onKeyUp: event => {
      onKeyUp?.(event);
      if (
        (event.key !== ' ' && event.key !== 'Enter') ||
        !pending.current.modified
      ) {
        return;
      }
      const version = pending.current.version;
      setTimeout(() => {
        if (pending.current.version === version) {
          pending.current.modified = false;
        }
      }, 0);
    },
    onClick: event => {
      const modifiedKeyboardPress =
        event.detail === 0 && (pending.current.modified || hasModifier(event));
      pending.current.version++;
      pending.current.modified = false;
      if (modifiedKeyboardPress) {
        event.preventDefault();
        return;
      }
      pressHandler(disabled, onPress)(event);
    },
    onBlur: event => {
      pending.current.version++;
      pending.current.modified = false;
      onBlur?.(event);
    },
  };
}
