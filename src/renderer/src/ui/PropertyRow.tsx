import {useId, type JSX, type ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import styles from './PropertyRow.module.css';

const GROUP_ICON_SIZE = 12;
const VALUE_ICON_SIZE = 14;

/** Where the rows sit: a property panel (name 84) or a window (name 168). */
export type PropertiesPlacement = 'panel' | 'window';

/**
 * The property field of one panel or window. Its placement sets the name cell
 * width and the row height for every row inside.
 */
export function Properties({
  placement = 'panel',
  className,
  children,
}: {
  readonly placement?: PropertiesPlacement | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={classNames(
        styles.properties,
        placement === 'window' && styles.window,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Two columns of property groups, as in the Look editor. */
export function PropertyColumns({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className={styles.columns}>{children}</div>;
}

/** A named group of rows with a line below it. */
export function PropertyGroup({
  title,
  icon,
  children,
}: {
  /** One or two words, such as 이번 예배 or 안정성. */
  readonly title: string;
  /** A 12px icon before the title, such as `note` for 메모. */
  readonly icon?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className={styles.group}>
      <p id={titleId} className={styles.groupTitle}>
        {icon === undefined ? null : (
          <Icon name={icon} size={GROUP_ICON_SIZE} />
        )}
        {title}
      </p>
      {children}
    </div>
  );
}

export interface PropertyRowProps {
  /** A short noun, such as 배경 or 연결이 끊기면. */
  readonly label: string;
  /**
   * Draws the control and gives it the id that the name points at, so that a
   * click on the name focuses or toggles the control.
   */
  readonly children: (controlId: string) => ReactNode;
  /** Aligns the name with the first line of a multi-line control. */
  readonly alignTop?: boolean | undefined;
}

/** One name and one control side by side. */
export function PropertyRow({
  label,
  children,
  alignTop = false,
}: PropertyRowProps): JSX.Element {
  const controlId = useId();
  return (
    <div className={classNames(styles.row, alignTop && styles.top)}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      <span className={styles.control}>{children(controlId)}</span>
    </div>
  );
}

export interface PropertyValueProps {
  readonly label: string;
  /** The read-only value with its unit, such as 60Hz or 1.0.0. */
  readonly value: string;
  /** A 14px icon before the value, such as `link` for the source song. */
  readonly icon?: string | undefined;
  /** Draws a value that reads like a name in `text`. */
  readonly primary?: boolean | undefined;
  /** Extra information after the value, such as 라이브러리. */
  readonly meta?: string | undefined;
}

/** A row with a name and a read-only value. */
export function PropertyValue({
  label,
  value,
  icon,
  primary = false,
  meta,
}: PropertyValueProps): JSX.Element {
  const labelId = useId();
  return (
    <div className={styles.row} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <span className={styles.control}>
        <span className={classNames(styles.value, primary && styles.primary)}>
          {icon === undefined ? null : (
            <Icon
              name={icon}
              size={VALUE_ICON_SIZE}
              className={styles.valueIcon}
            />
          )}
          {value}
        </span>
        {meta === undefined ? null : (
          <span className={styles.meta}>{meta}</span>
        )}
      </span>
    </div>
  );
}
