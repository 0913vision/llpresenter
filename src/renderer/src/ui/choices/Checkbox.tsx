import {useId, type ComponentPropsWithRef, type JSX} from 'react';
import {classNames} from '../classNames';
import {Icon} from '../Icon';
import {useButtonPress} from '../buttons/press';
import {titleTooltip, useTooltip, withTooltipProps} from '../popups/Tooltip';
import styles from './Checkbox.module.css';

/** On, off, or mixed for a group header with only some items on. */
export type CheckState = boolean | 'mixed';

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'role' | 'children' | 'onChange' | 'disabled'
> {
  readonly checked: CheckState;
  /** Reports the next state: on when it was off or mixed, else off. */
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean | undefined;
}

const MARK_SIZE = 12;

/** The state a press leads to: on from off or mixed, off from on. */
export function nextCheckState(checked: CheckState): boolean {
  return checked !== true;
}

/** A 16px checkbox. Space toggles it; Enter is left to the dialog. */
export function Checkbox({
  checked,
  onChange,
  disabled = false,
  className,
  onKeyDown,
  onKeyUp,
  onBlur,
  title,
  ...rest
}: CheckboxProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  const {onBlur: pressBlur, ...press} = useButtonPress({
    disabled,
    spaceOnly: true,
    onPress: () => onChange(nextCheckState(checked)),
    onKeyDown,
    onKeyUp,
    onBlur,
  });
  return (
    <>
      <button
        {...rest}
        {...withTooltipProps({...rest, onBlur: pressBlur}, targetProps)}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled ? true : undefined}
        className={classNames(styles.check, className)}
        {...press}
      >
        {checked === true ? <Icon name="check" size={MARK_SIZE} /> : null}
      </button>
      {tooltip}
    </>
  );
}

/** Where a check row sits: in a dialog, in a list, or as a group header. */
export type CheckRowVariant = 'plain' | 'list' | 'group';

export interface CheckRowProps {
  readonly checked: CheckState;
  readonly onChange: (checked: boolean) => void;
  /** The name of what is picked. */
  readonly label: string;
  readonly icon?: string | undefined;
  /** What it holds now, after a fixed-width name, as in 출력 상태 복구. */
  readonly value?: string | undefined;
  /** Extra info at the right end, such as the 구성 name. */
  readonly meta?: string | undefined;
  readonly variant?: CheckRowVariant | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the row is disabled. */
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

const variantClass = {
  plain: undefined,
  list: styles.list,
  group: classNames(styles.list, styles.group),
} as const satisfies Record<CheckRowVariant, string | undefined>;

/** A row with a checkbox that toggles from a press anywhere on it. */
export function CheckRow({
  checked,
  onChange,
  label,
  icon,
  value,
  meta,
  variant = 'plain',
  disabled = false,
  title,
  className,
}: CheckRowProps): JSX.Element {
  const labelId = useId();
  const detailId = useId();
  const detail = value ?? meta;
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  return (
    <label
      {...targetProps}
      className={classNames(styles.row, variantClass[variant], className)}
    >
      <Checkbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={detail === undefined ? undefined : detailId}
      />
      {icon === undefined ? null : (
        <Icon name={icon} className={styles.rowIcon} />
      )}
      <span
        id={labelId}
        className={classNames(styles.text, value !== undefined && styles.fixed)}
      >
        {label}
      </span>
      {value === undefined ? null : (
        <span id={detailId} className={styles.value}>
          {value}
        </span>
      )}
      {meta === undefined || value !== undefined ? null : (
        <span id={detailId} className={styles.meta}>
          {meta}
        </span>
      )}
      {tooltip}
    </label>
  );
}
