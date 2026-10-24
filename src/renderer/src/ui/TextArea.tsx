import type {ComponentPropsWithoutRef, JSX} from 'react';
import {classNames} from './classNames';
import {useFieldReason} from './fieldFrame';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
import styles from './TextField.module.css';

export interface TextAreaProps extends Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'value' | 'onChange' | 'title'
> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly invalid?: boolean | undefined;
  readonly invalidReason?: string | undefined;
  /** Tooltip text, such as the reason the field is disabled. */
  readonly title?: string | undefined;
}

/**
 * A multiline field for notes. It grows with its content from 72px and
 * scrolls inside past eight lines.
 */
export function TextArea({
  value,
  onChange,
  invalid = false,
  invalidReason,
  title,
  className,
  'aria-describedby': describedBy,
  ...rest
}: TextAreaProps): JSX.Element {
  const reason = useFieldReason({
    invalid,
    reason: invalidReason,
    describedBy,
    title,
  });
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason.tooltip));
  return (
    <>
      <textarea
        {...rest}
        {...withTooltipProps(
          {...rest, 'aria-describedby': reason.describedBy},
          targetProps,
        )}
        value={value}
        aria-invalid={invalid ? true : undefined}
        className={classNames(styles.textarea, className)}
        onChange={event => onChange(event.target.value)}
      />
      {reason.element}
      {tooltip}
    </>
  );
}
