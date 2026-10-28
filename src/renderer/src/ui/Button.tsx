import type {ComponentPropsWithRef, JSX, ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useButtonPress} from './press';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
import type {ControlSize} from './types';
import styles from './Button.module.css';

export type ButtonVariant = 'secondary' | 'primary' | 'ghost';

export interface ButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'disabled' | 'type'
> {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ControlSize | undefined;
  /** An icon name drawn before the text. */
  readonly icon?: string | undefined;
  /** Ignores presses and draws the disabled state; the button stays focusable. */
  readonly disabled?: boolean | undefined;
  readonly type?: 'button' | 'submit' | undefined;
  readonly children: ReactNode;
}

const variantClass: Readonly<Record<ButtonVariant, string | undefined>> = {
  secondary: undefined,
  primary: styles.primary,
  ghost: styles.ghost,
};

const iconSize = {sm: 14, md: 16} as const satisfies Record<
  ControlSize,
  number
>;

/** A command button with a text label. */
export function Button({
  variant = 'secondary',
  size = 'sm',
  icon,
  disabled = false,
  type = 'button',
  className,
  onClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  title,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  const {onBlur: pressBlur, ...press} = useButtonPress({
    disabled,
    onPress: onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
  });
  return (
    <>
      <button
        {...rest}
        {...withTooltipProps({...rest, onBlur: pressBlur}, targetProps)}
        type={type}
        aria-disabled={disabled ? true : undefined}
        className={classNames(
          styles.button,
          variantClass[variant],
          size === 'md' && styles.md,
          icon !== undefined && styles.lead,
          className,
        )}
        {...press}
      >
        {icon === undefined ? null : <Icon name={icon} size={iconSize[size]} />}
        {children}
      </button>
      {tooltip}
    </>
  );
}
