import type {ComponentPropsWithRef, JSX} from 'react';
import {classNames} from './classNames';
import {pressHandler, spaceOnlyKeyHandler} from './press';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'role' | 'children' | 'onChange' | 'disabled'
> {
  readonly checked: boolean;
  /** Reports the opposite value on each press. */
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean | undefined;
}

/**
 * A 30x18 switch for a setting that applies at once. A press or Space toggles
 * it; the arrow keys don't.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  className,
  onKeyDown,
  ...rest
}: SwitchProps): JSX.Element {
  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled ? true : undefined}
      className={classNames(styles.switch, className)}
      onClick={pressHandler(disabled, () => onChange(!checked))}
      onKeyDown={spaceOnlyKeyHandler(onKeyDown)}
    />
  );
}

export interface SwitchRowProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** What happens when it is on, such as 이름표 인식. */
  readonly label: string;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the switch is disabled. */
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

/** A name followed by its switch; a press on the name toggles it too. */
export function SwitchRow({
  checked,
  onChange,
  label,
  disabled = false,
  title,
  className,
}: SwitchRowProps): JSX.Element {
  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <label title={title} className={classNames(styles.row, className)}>
      {label}
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}
