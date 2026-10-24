import {
  useId,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {pressHandler, spaceOnlyKeyHandler} from './press';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
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
  title,
  ...rest
}: CheckboxProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  return (
    <>
      <button
        {...rest}
        {...withTooltipProps(rest, targetProps)}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled ? true : undefined}
        className={classNames(styles.check, className)}
        onClick={pressHandler(disabled, () =>
          onChange(nextCheckState(checked)),
        )}
        onKeyDown={spaceOnlyKeyHandler(onKeyDown)}
      >
        {checked === true ? <Icon name="check" size={MARK_SIZE} /> : null}
      </button>
      {tooltip}
    </>
  );
}

/** The look of a check row: in a dialog, in a list, or a group header. */
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

const CHECKBOX = '[role="checkbox"]';

const listKeyTargets: Readonly<
  Record<
    string,
    (boxes: HTMLElement[], index: number) => HTMLElement | undefined
  >
> = {
  ArrowDown: (boxes, index) => boxes[Math.min(index + 1, boxes.length - 1)],
  ArrowUp: (boxes, index) => boxes[Math.max(index - 1, 0)],
  Home: boxes => boxes[0],
  End: boxes => boxes.at(-1),
};

function checkboxesIn(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(CHECKBOX)];
}

/** Leaves one Tab stop in the list: the box last in focus, else the first. */
function keepOneTabStop(list: HTMLElement, last: HTMLElement | null): void {
  const boxes = checkboxesIn(list);
  const stop = last !== null && boxes.includes(last) ? last : boxes[0];
  for (const box of boxes) box.tabIndex = box === stop ? 0 : -1;
}

export interface CheckListProps {
  /** The list name, such as 예배 순서. */
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * A list of check rows that Tab enters once. The up and down arrows, Home,
 * and End move between the boxes, and Space toggles the one in focus.
 */
export function CheckList({
  label,
  className,
  children,
}: CheckListProps): JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (list.current !== null) {
      keepOneTabStop(list.current, lastFocused.current);
    }
  });

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.matches(CHECKBOX)) return;
    lastFocused.current = event.target;
    keepOneTabStop(event.currentTarget, event.target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = listKeyTargets[event.key];
    if (target === undefined || !(event.target instanceof HTMLElement)) return;
    event.preventDefault();
    const boxes = checkboxesIn(event.currentTarget);
    const current = event.target.closest(CHECKBOX);
    target(
      boxes,
      boxes.findIndex(box => box === current),
    )?.focus();
  };

  return (
    <div
      ref={list}
      role="group"
      aria-label={label}
      className={className}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
