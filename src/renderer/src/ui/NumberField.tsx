import {
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {classNames} from './classNames';
import {FieldFrame, useFieldReason} from './fieldFrame';
import {
  clampNumber,
  formatNumberText,
  parseNumberText,
  stepNumber,
  type NumberRange,
} from './numberText';
import styles from './TextField.module.css';

export interface NumberFieldProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  | 'value'
  | 'onChange'
  | 'size'
  | 'type'
  | 'className'
  | 'title'
  | 'min'
  | 'max'
  | 'step'
> {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  /** The change for one press of the up or down arrow. Defaults to 1. */
  readonly step?: number | undefined;
  /** A unit drawn outside the field, such as 개 or 줄. */
  readonly unit?: string | undefined;
  /** A unit that is part of the value, such as `%`. */
  readonly suffix?: string | undefined;
  readonly invalid?: boolean | undefined;
  readonly invalidReason?: string | undefined;
  /** Tooltip text, such as the reason the field is disabled. */
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

const SHIFT_STEPS = 10;

const arrowSteps: Readonly<Record<string, 1 | -1>> = {
  ArrowUp: 1,
  ArrowDown: -1,
};

/**
 * A number field. The up and down arrows change the value by one step, or by
 * ten with Shift, and a value outside the range snaps into it when focus
 * leaves.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  suffix = '',
  invalid = false,
  invalidReason,
  title,
  className,
  onBlur,
  onKeyDown,
  'aria-describedby': describedBy,
  ...rest
}: NumberFieldProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const reason = useFieldReason({
    invalid,
    reason: invalidReason,
    describedBy,
    title,
  });
  const range: NumberRange = {min, max};
  const shown = formatNumberText(value, suffix);

  const report = (next: number): void => {
    if (next !== value) onChange(next);
  };

  const type = (text: string): void => {
    setDraft(text);
    const typed = parseNumberText(text, suffix);
    if (typed !== undefined && clampNumber(typed, range) === typed) {
      report(typed);
    }
  };

  const commit = (): void => {
    if (draft === null) return;
    const typed = parseNumberText(draft, suffix);
    if (typed !== undefined) report(clampNumber(typed, range));
    setDraft(null);
  };

  const stepBy = (steps: number): void => {
    const base = parseNumberText(draft ?? shown, suffix) ?? value;
    report(stepNumber(clampNumber(base, range), {step, steps, range}));
    setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter') {
      commit();
      return;
    }
    const direction = arrowSteps[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    stepBy(direction * (event.shiftKey ? SHIFT_STEPS : 1));
  };

  const field = (
    <FieldFrame
      className={classNames(styles.field, styles.number, className)}
      title={reason.tooltip}
      inputRef={inputRef}
    >
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={shown}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={reason.describedBy}
        value={draft ?? shown}
        className={styles.input}
        onChange={event => type(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={event => {
          commit();
          onBlur?.(event);
        }}
      />
      {reason.element}
    </FieldFrame>
  );

  if (unit === undefined) return field;
  return (
    <span className={styles.numberRow}>
      {field}
      <span className={styles.unit}>{unit}</span>
    </span>
  );
}
