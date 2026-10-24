import {
  useId,
  type JSX,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './TextField.module.css';

export interface FieldFrameProps {
  readonly className: string;
  /** Tooltip text for the whole field. */
  readonly title: string | undefined;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly children: ReactNode;
}

/**
 * The outer box of a single-line field. A press anywhere on it, the leading
 * icon included, focuses the input.
 */
export function FieldFrame({
  className,
  title,
  inputRef,
  children,
}: FieldFrameProps): JSX.Element {
  const focusInput = (event: MouseEvent<HTMLSpanElement>): void => {
    const input = inputRef.current;
    if (input === null || event.target === input) return;
    if (event.target instanceof Element && event.target.closest('button')) {
      return;
    }
    event.preventDefault();
    input.focus();
  };
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  return (
    <span {...targetProps} className={className} onMouseDown={focusInput}>
      {children}
      {tooltip}
    </span>
  );
}

export interface FieldReason {
  /** The value for the field's `aria-describedby`. */
  readonly describedBy: string | undefined;
  /** The field's tooltip: the reason while invalid, else the caller's title. */
  readonly tooltip: string | undefined;
  /** The reason as hidden text for assistive technology. */
  readonly element: JSX.Element | null;
}

export interface FieldReasonOptions {
  readonly invalid: boolean;
  readonly reason: string | undefined;
  /** The caller's own `aria-describedby`, kept in front of the reason. */
  readonly describedBy: string | undefined;
  /** The caller's tooltip text. */
  readonly title: string | undefined;
}

/** Describes why a field is invalid; the reason is shown only as a tooltip. */
export function useFieldReason({
  invalid,
  reason,
  describedBy,
  title,
}: FieldReasonOptions): FieldReason {
  const id = useId();
  if (!invalid || reason === undefined) {
    return {describedBy, tooltip: title, element: null};
  }
  return {
    describedBy: describedBy === undefined ? id : `${describedBy} ${id}`,
    tooltip: reason,
    element: (
      <span id={id} className={styles.description}>
        {reason}
      </span>
    ),
  };
}
