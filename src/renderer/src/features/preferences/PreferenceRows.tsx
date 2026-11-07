import type {JSX} from 'react';
import {NumberField} from '@renderer/ui/NumberField';
import {Button} from '@renderer/ui/Button';
import {PropertyRow, PropertyValue} from '@renderer/ui/PropertyRow';
import styles from './PreferenceRows.module.css';
import {TextField} from '@renderer/ui/TextField';
import {SelectMenu, type SelectOption} from '@renderer/ui/SelectMenu';
import {Checkbox} from '@renderer/ui/Checkbox';
import {
  SegmentedControl,
  type SegmentOption,
} from '@renderer/ui/SegmentedControl';

interface RowProps {
  readonly label: string;
  /** Why the row can't change, or when a change takes effect. */
  readonly title?: string | undefined;
  readonly disabled?: boolean | undefined;
}

/** A row with a checkbox that saves at once. */
export function CheckboxRow({
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
        <Checkbox
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

/** A row with a segmented choice that saves at once. */
export function SegmentedRow<T extends string>({
  label,
  title,
  disabled,
  options,
  value,
  onChange,
}: RowProps & {
  readonly options: ReadonlyArray<SegmentOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId, labelId}) => (
        <SegmentedControl
          id={controlId}
          labelledBy={labelId}
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
  step,
  unit,
  onChange,
}: RowProps & {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number | undefined;
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
          step={step}
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

const NO_CHANGE = (): void => undefined;

/** A read-only folder path with a folder icon and 바꾸기. */
export function PathRow({
  label,
  title,
  disabled,
  path,
  onChange,
}: RowProps & {
  readonly path: string;
  readonly onChange: () => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <>
          <TextField
            id={controlId}
            block
            readOnly
            icon="folder"
            value={path}
            title={title}
            onChange={NO_CHANGE}
          />
          <Button size="md" disabled={disabled} onClick={onChange}>
            바꾸기
          </Button>
        </>
      )}
    </PropertyRow>
  );
}

/** A read-only value with a button at its end, such as 마지막 백업. */
export function ValueActionRow({
  label,
  value,
  action,
  disabled,
  title,
  onAction,
}: RowProps & {
  readonly value: string;
  readonly action: string;
  readonly onAction: () => void;
}): JSX.Element {
  return (
    <PropertyValue
      label={label}
      value={value}
      action={
        <Button size="md" disabled={disabled} title={title} onClick={onAction}>
          {action}
        </Button>
      }
    />
  );
}

/**
 * A row with only an action: the button starts the control column, and the
 * result of the action, such as 복사했습니다, follows it.
 */
export function ActionRow({
  label,
  action,
  result,
  disabled,
  title,
  onAction,
}: RowProps & {
  readonly action: string;
  readonly result?: string | undefined;
  readonly onAction: () => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {() => (
        <>
          <Button
            size="md"
            disabled={disabled}
            title={title}
            onClick={onAction}
          >
            {action}
          </Button>
          {result === undefined || result === '' ? null : (
            <span role="status" className={styles.result}>
              {result}
            </span>
          )}
        </>
      )}
    </PropertyRow>
  );
}

type TransitionKind = 'none' | 'dissolve';

const TRANSITION_OPTIONS = [
  {value: 'none', label: '없음'},
  {value: 'dissolve', label: '디졸브'},
] as const;

/** A 전환 choice, with its seconds on the same row while it is a dissolve. */
export function TransitionRow({
  label,
  disabled,
  title,
  kind,
  seconds,
  limits,
  onKind,
  onSeconds,
}: RowProps & {
  readonly kind: TransitionKind;
  readonly seconds: number;
  readonly limits: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  };
  readonly onKind: (kind: TransitionKind) => void;
  readonly onSeconds: (seconds: number) => void;
}): JSX.Element {
  return (
    <PropertyRow label={label}>
      {({controlId, labelId}) => (
        <>
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            disabled={disabled}
            title={title}
            options={TRANSITION_OPTIONS}
            value={kind}
            onChange={onKind}
          />
          {kind === 'none' ? null : (
            <NumberField
              aria-label={`${label} 시간`}
              value={seconds}
              {...limits}
              unit="초"
              updateOn="commit"
              readOnly={disabled}
              title={title}
              onChange={onSeconds}
            />
          )}
        </>
      )}
    </PropertyRow>
  );
}
