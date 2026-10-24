import type {ComponentPropsWithoutRef, JSX} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
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

/** Two to five segments in a sunken track, of which one is selected. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
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

  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <div
      role={groupRole[kind]}
      aria-label={label}
      aria-labelledby={labelledBy}
      title={title}
      className={classNames(styles.track, fill && styles.fill, className)}
    >
      {options.map((option, index) => {
        const isIcon = option.icon !== undefined;
        return (
          <button
            key={option.value}
            ref={roving.refOf(index)}
            type="button"
            {...selectionAttributes(kind, option.value === value)}
            tabIndex={roving.tabIndexOf(index)}
            aria-label={accessibleName(option)}
            aria-disabled={
              disabled || option.disabled === true ? true : undefined
            }
            title={option.title ?? (isIcon ? option.label : undefined)}
            className={classNames(styles.segment, isIcon && styles.iconSegment)}
            onClick={() => select(option)}
            onKeyDown={event => roving.onKeyDown(index, event)}
          >
            <SegmentContent option={option} />
          </button>
        );
      })}
    </div>
  );
}
