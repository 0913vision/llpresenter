import type {JSX} from 'react';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu, type SelectOption} from '@renderer/ui/SelectMenu';
import {Switch} from '@renderer/ui/Switch';

interface RowProps {
  readonly label: string;
  /** Why the row can't change, or when a change takes effect. */
  readonly title?: string | undefined;
  readonly disabled?: boolean | undefined;
}

/** A row with a switch that saves at once. */
export function SwitchRow({
  label,
  title,
  disabled,
  checked,
  onChange,
}: RowProps & {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <Switch
          id={controlId}
          checked={checked}
          disabled={disabled}
          title={title}
          onChange={onChange}
        />
      )}
    </PropertyRow>
  );
}

/** A row with a select that saves at once. */
export function SelectRow<T extends string>({
  label,
  title,
  disabled,
  options,
  value,
  onChange,
}: RowProps & {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel={label}
          disabled={disabled}
          title={title}
          options={options}
          value={value}
          onChange={onChange}
        />
      )}
    </PropertyRow>
  );
}

/** A row with a number field that saves when its value is committed. */
export function CountRow({
  label,
  title,
  disabled,
  value,
  min,
  max,
  unit,
  onChange,
}: RowProps & {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly onChange: (value: number) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <NumberField
          id={controlId}
          value={value}
          min={min}
          max={max}
          unit={unit}
          updateOn="commit"
          readOnly={disabled}
          title={title}
          onChange={onChange}
        />
      )}
    </PropertyRow>
  );
}
