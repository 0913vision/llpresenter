import type {
  ComponentPropsWithRef,
  JSX,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {labelColorValue, type LabelColor} from './labelColor';
import {pressHandler} from './press';
import type {ControlSize} from './types';
import styles from './Select.module.css';

/** What comes before the value: an icon, a media image, or a macro tile. */
export type SelectLead =
  | {readonly kind: 'icon'; readonly icon: string}
  | {readonly kind: 'media'; readonly src: string}
  | {readonly kind: 'tile'; readonly color: LabelColor; readonly icon: string};

/** What the button opens: a list of choices, or a popover such as a calendar. */
export type SelectPopup = 'listbox' | 'dialog';

export interface SelectProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'children' | 'value' | 'disabled'
> {
  /** The current value as shown. Write 없음 when there is none. */
  readonly value: string;
  /** Short extra info after the value, such as 곡 기본값. */
  readonly meta?: string | undefined;
  readonly lead?: SelectLead | undefined;
  readonly size?: ControlSize | undefined;
  /** Fills the control cell of a property row. */
  readonly block?: boolean | undefined;
  /** Draws the value with tabular numbers, for dates, times, and sizes. */
  readonly numeric?: boolean | undefined;
  readonly popup?: SelectPopup | undefined;
  /** Whether the list or popover it opens is open. */
  readonly expanded: boolean;
  /** Asks to open or close the list: click, Enter, Space, or the Down arrow. */
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly disabled?: boolean | undefined;
}

const CHEVRON_SIZE = 12;
const TILE_ICON_SIZE = 14;
const iconSize = {sm: 14, md: 16} as const satisfies Record<
  ControlSize,
  number
>;

function Lead({
  lead,
  size,
}: {
  readonly lead: SelectLead;
  readonly size: ControlSize;
}): JSX.Element {
  switch (lead.kind) {
    case 'icon':
      return (
        <Icon name={lead.icon} size={iconSize[size]} className={styles.icon} />
      );
    case 'media':
      return <img className={styles.media} src={lead.src} alt="" />;
    case 'tile':
      return (
        <span
          className={styles.tile}
          data-color={lead.color}
          style={{backgroundColor: labelColorValue(lead.color)}}
        >
          <Icon name={lead.icon} size={TILE_ICON_SIZE} />
        </span>
      );
  }
}

/**
 * A dropdown button that shows the current value. It draws only the button;
 * the caller opens the list below it.
 */
export function Select({
  value,
  meta,
  lead,
  size = 'md',
  block = false,
  numeric = false,
  popup = 'listbox',
  expanded,
  onExpandedChange,
  disabled = false,
  className,
  onClick,
  onKeyDown,
  ...rest
}: SelectProps): JSX.Element {
  const toggle = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    onExpandedChange(!expanded);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (!expanded) onExpandedChange(true);
  };

  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <button
      {...rest}
      type="button"
      aria-haspopup={popup}
      aria-expanded={expanded}
      aria-disabled={disabled ? true : undefined}
      className={classNames(
        styles.select,
        size === 'sm' && styles.sm,
        block && styles.block,
        lead !== undefined && lead.kind !== 'icon' && styles.withImage,
        className,
      )}
      onClick={pressHandler(disabled, toggle)}
      onKeyDown={handleKeyDown}
    >
      {lead === undefined ? null : <Lead lead={lead} size={size} />}
      <span className={classNames(styles.value, numeric && styles.numeric)}>
        {value}
      </span>
      {meta === undefined ? null : <span className={styles.meta}>{meta}</span>}
      <Icon name="down" size={CHEVRON_SIZE} className={styles.chevron} />
    </button>
  );
}
