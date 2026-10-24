import {
  useRef,
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {classNames} from './classNames';
import {FieldFrame, useFieldReason} from './fieldFrame';
import {Icon} from './Icon';
import type {ControlSize} from './types';
import styles from './TextField.module.css';

/** The plain field, or the song title field inside a panel header. */
export type TextFieldVariant = 'default' | 'title';

export interface TextFieldProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'size' | 'type' | 'className' | 'title'
> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly size?: ControlSize | undefined;
  readonly variant?: TextFieldVariant | undefined;
  /** A leading icon, such as `search` or `book`. */
  readonly icon?: string | undefined;
  /**
   * Makes it a search field: a clear-text button while there is a value, and
   * Esc clears the value or, when empty, releases focus.
   */
  readonly clearable?: boolean | undefined;
  /** A short prefix inside the field, such as 시작 or 끝. */
  readonly affix?: string | undefined;
  /** Right-aligns the value with tabular numbers, for times like 00:30.0. */
  readonly numeric?: boolean | undefined;
  /** Adds `ring-field`, for a field on `bg-app`. */
  readonly ring?: boolean | undefined;
  /** Fills the width of its cell. */
  readonly block?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  /** Why the value can't be saved; shown as the tooltip while invalid. */
  readonly invalidReason?: string | undefined;
  /** Tooltip text, such as the reason the field is disabled. */
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

const iconSize = {sm: 14, md: 16} as const satisfies Record<
  ControlSize,
  number
>;
const clearIconSize = {sm: 12, md: 14} as const satisfies Record<
  ControlSize,
  number
>;

interface FrameLook {
  readonly size: ControlSize;
  readonly variant: TextFieldVariant;
  readonly ring: boolean;
  readonly block: boolean;
  readonly numeric: boolean;
  readonly className: string | undefined;
}

function frameClass({
  size,
  variant,
  ring,
  block,
  numeric,
  className,
}: FrameLook): string {
  return classNames(
    styles.field,
    variant === 'title' ? styles.title : size === 'sm' && styles.sm,
    ring && styles.ring,
    block && styles.block,
    numeric && styles.numeric,
    className,
  );
}

/** A single-line text field: search, Bible verses, names, and titles. */
export function TextField({
  value,
  onChange,
  size = 'md',
  variant = 'default',
  icon,
  clearable = false,
  affix,
  numeric = false,
  ring = false,
  block = false,
  invalid = false,
  invalidReason,
  title,
  className,
  disabled = false,
  readOnly = false,
  onKeyDown,
  'aria-describedby': describedBy,
  ...rest
}: TextFieldProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const reason = useFieldReason({
    invalid,
    reason: invalidReason,
    describedBy,
    title,
  });
  const canClear = clearable && value !== '' && !disabled && !readOnly;

  const clear = (): void => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented || readOnly || !clearable) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (value === '') {
      event.currentTarget.blur();
      return;
    }
    event.stopPropagation();
    onChange('');
  };

  return (
    <FieldFrame
      className={frameClass({
        size,
        variant,
        ring,
        block,
        numeric,
        className,
      })}
      title={reason.tooltip}
      inputRef={inputRef}
    >
      {icon === undefined ? null : <Icon name={icon} size={iconSize[size]} />}
      {affix === undefined ? null : (
        <span className={styles.affix}>{affix}</span>
      )}
      <input
        {...rest}
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={reason.describedBy}
        className={styles.input}
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {canClear ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="검색어 지우기"
          className={styles.clear}
          onMouseDown={event => event.preventDefault()}
          onClick={clear}
        >
          <Icon name="x" size={clearIconSize[size]} />
        </button>
      ) : null}
      {reason.element}
    </FieldFrame>
  );
}
