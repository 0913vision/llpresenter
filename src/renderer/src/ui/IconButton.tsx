import type {
  ComponentPropsWithRef,
  JSX,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {hasModifier} from './modifierKeys';
import {pressHandler} from './press';
import {useTooltip, withTooltipProps, type TooltipContent} from './Tooltip';
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

function tooltipContent(
  label: string,
  shortcut: string | undefined,
  title: string | undefined,
): TooltipContent {
  return title === undefined ? {text: label, shortcut} : {text: title};
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
  onKeyDown,
  ...rest
}: IconButtonProps): JSX.Element {
  const press = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    if (pressed !== undefined) onPressedChange?.(!pressed);
  };
  const guardedPress = pressHandler(disabled, press);
  // NOTE(0913vision): An icon button often sits at the end of a list row that
  // selects on a click, Enter, or Space, so its presses must not reach the
  // row, even while the button is disabled.
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    guardedPress(event);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const rowKey = event.key === 'Enter' || event.key === ' ';
    if (rowKey && !hasModifier(event)) event.stopPropagation();
    onKeyDown?.(event);
  };
  const {targetProps, tooltip} = useTooltip(
    tooltipContent(label, shortcut, title),
  );
  return (
    <>
      <button
        {...rest}
        {...withTooltipProps(rest, targetProps)}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? expanded : undefined}
        aria-disabled={disabled ? true : undefined}
        className={classNames(
          styles.button,
          size === 'md' && styles.md,
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Icon name={icon} size={ICON_SIZE} />
      </button>
      {tooltip}
    </>
  );
}
