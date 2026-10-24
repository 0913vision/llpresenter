import type {ComponentPropsWithoutRef, JSX, KeyboardEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
import {titleTooltip, useTooltip} from './Tooltip';
import type {GroupName} from './types';
import styles from './SegmentedControl.module.css';

/**
 * How the group reports its choice: a radio group that picks a value, tabs
 * that switch the content inside a panel, or a view switch.
 */
export type SegmentedKind = 'radio' | 'tabs' | 'toggle';

export interface SegmentOption<T extends string> {
  readonly value: T;
  /** The visible name, or the accessible name and tooltip of an icon segment. */
  readonly label: string;
  /** Draws an icon segment instead of a text segment. */
  readonly icon?: string | undefined;
  readonly count?: number | undefined;
  /** Draws the count in the warning color, for things that need fixing. */
  readonly warning?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the segment is disabled. */
  readonly title?: string | undefined;
}

export type SegmentedControlProps<T extends string> = GroupName & {
  readonly options: ReadonlyArray<SegmentOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** The id of the track, such as a property row's control id. */
  readonly id?: string | undefined;
  readonly kind?: SegmentedKind | undefined;
  /** Stretches the track and shares its width equally among the segments. */
  readonly fill?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly title?: string | undefined;
  readonly className?: string | undefined;
};

const ICON_SIZE = 14;

function accessibleName<T extends string>(
  option: SegmentOption<T>,
): string | undefined {
  if (option.icon !== undefined) return option.label;
  if (option.count !== undefined) return `${option.label} ${option.count}`;
  return undefined;
}

const groupRole = {
  radio: 'radiogroup',
  tabs: 'tablist',
  toggle: 'group',
} as const satisfies Record<SegmentedKind, string>;

type SelectionAttributes = Pick<
  ComponentPropsWithoutRef<'button'>,
  'role' | 'aria-checked' | 'aria-selected' | 'aria-pressed'
>;

function selectionAttributes(
  kind: SegmentedKind,
  selected: boolean,
): SelectionAttributes {
  switch (kind) {
    case 'radio':
      return {role: 'radio', 'aria-checked': selected};
    case 'tabs':
      return {role: 'tab', 'aria-selected': selected};
    case 'toggle':
      return {'aria-pressed': selected};
  }
}

function SegmentContent<T extends string>({
  option,
}: {
  readonly option: SegmentOption<T>;
}): JSX.Element {
  if (option.icon !== undefined) {
    return <Icon name={option.icon} size={ICON_SIZE} />;
  }
  return (
    <>
      <span className={styles.label}>{option.label}</span>
      {option.count === undefined ? null : (
        <span
          className={classNames(styles.count, option.warning && styles.warning)}
        >
          {option.count}
        </span>
      )}
    </>
  );
}

interface SegmentProps<T extends string> {
  readonly option: SegmentOption<T>;
  readonly kind: SegmentedKind;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

function Segment<T extends string>({
  option,
  kind,
  selected,
  disabled,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: SegmentProps<T>): JSX.Element {
  const isIcon = option.icon !== undefined;
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(option.title ?? (isIcon ? option.label : undefined)),
  );
  return (
    <>
      <button
        {...targetProps}
        ref={elementRef}
        type="button"
        {...selectionAttributes(kind, selected)}
        tabIndex={tabIndex}
        aria-label={accessibleName(option)}
        aria-disabled={disabled ? true : undefined}
        className={classNames(styles.segment, isIcon && styles.iconSegment)}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <SegmentContent option={option} />
      </button>
      {tooltip}
    </>
  );
}

/** Two to five segments in a sunken track, of which one is selected. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  id,
  kind = 'radio',
  fill = false,
  disabled = false,
  title,
  className,
}: SegmentedControlProps<T>): JSX.Element {
  const roving = useRovingSelection({
    items: options,
    value,
    onChange,
    disabled,
  });

  const select = (option: SegmentOption<T>): void => {
    if (disabled || option.disabled === true || option.value === value) return;
    onChange(option.value);
  };

  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  return (
    <div
      {...targetProps}
      id={id}
      role={groupRole[kind]}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={classNames(styles.track, fill && styles.fill, className)}
    >
      {options.map((option, index) => (
        <Segment
          key={option.value}
          option={option}
          kind={kind}
          selected={option.value === value}
          disabled={disabled || option.disabled === true}
          tabIndex={roving.tabIndexOf(index)}
          elementRef={roving.refOf(index)}
          onSelect={() => select(option)}
          onKeyDown={event => roving.onKeyDown(index, event)}
        />
      ))}
      {tooltip}
    </div>
  );
}
