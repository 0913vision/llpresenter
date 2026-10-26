import {useId, useState, type JSX} from 'react';
import {Calendar} from './Calendar';
import {calendarFieldLabel, parseCalendarDate} from './calendarDates';
import {Select, type SelectProps} from './Select';

export interface DateSelectProps extends Omit<
  SelectProps,
  | 'value'
  | 'expanded'
  | 'onExpandedChange'
  | 'onChange'
  | 'lead'
  | 'numeric'
  | 'popup'
  | 'ref'
> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly today?: string | undefined;
}

/** A date field whose calendar commits ISO civil dates without timezone conversion. */
export function DateSelect({
  value,
  onChange,
  today,
  disabled = false,
  ...props
}: DateSelectProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (open && disabled) setOpen(false);
  const date = parseCalendarDate(value);
  const close = (): void => {
    setOpen(false);
    anchor?.focus({preventScroll: true});
  };
  return (
    <>
      <Select
        {...props}
        ref={setAnchor}
        disabled={disabled}
        value={date === null ? '날짜 선택' : calendarFieldLabel(date)}
        expanded={open && !disabled}
        onExpandedChange={setOpen}
        numeric
        lead={{kind: 'icon', icon: 'cal'}}
        popup="dialog"
        aria-controls={open ? id : undefined}
      />
      {open && !disabled && anchor !== null ? (
        <Calendar
          id={id}
          anchor={anchor}
          value={value}
          today={today}
          onChange={onChange}
          onClose={close}
        />
      ) : null}
    </>
  );
}
