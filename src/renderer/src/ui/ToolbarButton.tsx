import type {ComponentPropsWithRef, JSX, MouseEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {pressHandler} from './press';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
import {TOOLBAR_CHEVRON_SIZE, toolbarIconSize} from './toolbarLook';
import styles from './ToolbarButton.module.css';

export interface ToolbarButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'disabled' | 'type' | 'children' | 'aria-pressed'
> {
  readonly icon: string;
  readonly label: string;
  /** Draws the form for the 40 toolbar, with the name beside the icon. */
  readonly compact?: boolean | undefined;
  /** Hides compact action names; view toggles always keep their visible label. */
  readonly iconOnly?: boolean | undefined;
  /** Makes it a view toggle; each press reports the opposite value. */
  readonly pressed?: boolean | undefined;
  readonly onPressedChange?: ((pressed: boolean) => void) | undefined;
  /** Marks it as a button that opens a menu and draws the down arrow. */
  readonly menu?: boolean | undefined;
  /** Whether the menu it opens is open. */
  readonly expanded?: boolean | undefined;
  readonly disabled?: boolean | undefined;
}

interface ContentProps {
  readonly icon: string;
  readonly label: string;
  readonly compact: boolean;
  readonly labelHidden: boolean;
  readonly menu: boolean;
}

function variantClass(
  pressed: boolean | undefined,
  menu: boolean,
): string | undefined {
  if (menu) return styles.menu;
  if (pressed !== undefined) return styles.toggle;
  return undefined;
}

function Chevron(): JSX.Element {
  return (
    <Icon name="down" size={TOOLBAR_CHEVRON_SIZE} className={styles.chevron} />
  );
}

function Content({
  icon,
  label,
  compact,
  labelHidden,
  menu,
}: ContentProps): JSX.Element {
  const iconSize = toolbarIconSize(compact);
  if (labelHidden) return <Icon name={icon} size={iconSize} />;
  if (compact) {
    return (
      <>
        <Icon name={icon} size={iconSize} />
        <span className={styles.label}>{label}</span>
        {menu ? <Chevron /> : null}
      </>
    );
  }
  return (
    <>
      <span className={styles.iconSlot}>
        <Icon name={icon} size={iconSize} />
        {menu ? <Chevron /> : null}
      </span>
      <span className={styles.label}>{label}</span>
    </>
  );
}

/**
 * A toolbar action/menu button, or a separate horizontal view toggle (미디어).
 */
export function ToolbarButton({
  icon,
  label,
  compact = false,
  iconOnly = false,
  pressed,
  onPressedChange,
  menu = false,
  expanded = false,
  disabled = false,
  className,
  onClick,
  title,
  ...rest
}: ToolbarButtonProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  const viewToggle = pressed !== undefined && !menu;
  const labelHidden = compact && iconOnly && !viewToggle;
  const press = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    if (pressed !== undefined) onPressedChange?.(!pressed);
  };
  return (
    <>
      <button
        {...rest}
        {...withTooltipProps(rest, targetProps)}
        type="button"
        aria-label={labelHidden ? label : undefined}
        aria-pressed={pressed}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? expanded : undefined}
        aria-disabled={disabled ? true : undefined}
        className={classNames(
          styles.button,
          variantClass(pressed, menu),
          compact && styles.compact,
          labelHidden && styles.iconOnly,
          className,
        )}
        onClick={pressHandler(disabled, press)}
      >
        <Content
          icon={icon}
          label={label}
          compact={compact || viewToggle}
          labelHidden={labelHidden}
          menu={menu}
        />
      </button>
      {tooltip}
    </>
  );
}
