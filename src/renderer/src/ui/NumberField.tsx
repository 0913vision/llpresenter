import {
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {classNames} from './classNames';
import {FieldFrame, useFieldReason} from './fieldFrame';
import {isComposing} from './ime';
import {
  clampNumber,
  formatNumberText,
  parseNumberText,
  roundNumberToStep,
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
  /** The change with Shift; defaults to ten times step. */
  readonly largeStep?: number | undefined;
  /** `commit` buffers typing until Enter or blur; Escape cancels it. */
  readonly updateOn?: 'change' | 'commit' | undefined;
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

const DEFAULT_LARGE_STEP_MULTIPLIER = 10;

const arrowSteps: Readonly<Record<string, 1 | -1>> = {
  ArrowUp: 1,
  ArrowDown: -1,
};

/**
 * A number field. The up and down arrows change the value by one step, or by
 * largeStep with Shift. Enter and blur round typed values to a whole step,
 * then clamp to the range.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  largeStep = roundNumberToStep(step * DEFAULT_LARGE_STEP_MULTIPLIER, step),
  updateOn = 'change',
  unit,
  suffix = '',
  invalid = false,
  invalidReason,
  title,
  className,
  onBlur,
  onKeyDown,
  readOnly = false,
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
  const shown = formatNumberText(value, suffix, step);

  const report = (next: number): void => {
    if (next !== value) onChange(next);
  };

  const type = (text: string): void => {
    setDraft(text);
    const typed = parseNumberText(text, suffix);
    if (
      updateOn === 'change' &&
      typed !== undefined &&
      clampNumber(typed, range) === typed
    ) {
      report(typed);
    }
  };

  const commit = (): void => {
    if (draft === null) return;
    const typed = parseNumberText(draft, suffix);
    if (typed !== undefined) {
      report(clampNumber(roundNumberToStep(typed, step), range));
    }
    setDraft(null);
  };

  const stepBy = (direction: 1 | -1, increment: number): void => {
    const base = parseNumberText(draft ?? shown, suffix) ?? value;
    const snapped = roundNumberToStep(base, step);
    report(stepNumber(snapped, {step: increment, steps: direction, range}));
    setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented || readOnly) return;
    if (isComposing(event)) return;
    if (event.key === 'Escape' && updateOn === 'commit' && draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      return;
    }
    if (event.key === 'Enter') {
      if (updateOn === 'commit') event.preventDefault();
      commit();
      return;
    }
    const direction = arrowSteps[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    stepBy(direction, event.shiftKey ? largeStep : step);
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
        readOnly={readOnly}
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
