import type {ComponentPropsWithRef, JSX, MouseEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {pressHandler} from './press';
import type {ControlSize} from './types';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'disabled' | 'type' | 'children' | 'aria-label' | 'aria-pressed'
> {
  readonly icon: string;
  /** The accessible name, also shown in the tooltip. */
  readonly label: string;
  readonly size?: ControlSize | undefined;
  /** Makes it an on/off button; each press reports the opposite value. */
  readonly pressed?: boolean | undefined;
  readonly onPressedChange?: ((pressed: boolean) => void) | undefined;
  /** Marks it as a button that opens a menu. */
  readonly menu?: boolean | undefined;
  /** Whether the menu it opens is open. */
  readonly expanded?: boolean | undefined;
  /** A shortcut appended to the tooltip, such as `Esc`. */
  readonly shortcut?: string | undefined;
  readonly disabled?: boolean | undefined;
}

const ICON_SIZE = 16;

function tooltipText(label: string, shortcut: string | undefined): string {
  return shortcut === undefined ? label : `${label} ${shortcut}`;
}

/** A square ghost button with only an icon. */
export function IconButton({
  icon,
  label,
  size = 'sm',
  pressed,
  onPressedChange,
  menu = false,
  expanded = false,
  shortcut,
  disabled = false,
  className,
  title,
  onClick,
  ...rest
}: IconButtonProps): JSX.Element {
  const press = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    if (pressed !== undefined) onPressedChange?.(!pressed);
  };
  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <button
      {...rest}
      type="button"
      aria-label={label}
      title={title ?? tooltipText(label, shortcut)}
      aria-pressed={pressed}
      aria-haspopup={menu ? 'menu' : undefined}
      aria-expanded={menu ? expanded : undefined}
      aria-disabled={disabled ? true : undefined}
      className={classNames(
        styles.button,
        size === 'md' && styles.md,
        className,
      )}
      onClick={pressHandler(disabled, press)}
    >
      <Icon name={icon} size={ICON_SIZE} />
    </button>
  );
}
