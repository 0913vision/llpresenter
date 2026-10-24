import {
  createContext,
  useContext,
  useId,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {pressHandler} from './press';
import {LiveBadge} from './StatusMarks';
import {titleTooltip, useTooltip} from './Tooltip';
import {TruncatedText} from './TruncatedText';
import styles from './ListRow.module.css';

const ROW_ICON_SIZE = 16;
const WARN_ICON_SIZE = 14;
const ADD_ICON_SIZE = 12;
const SLOT_MARK = '빈 자리';
const OPTION = '[role="option"]:not([aria-disabled="true"])';

interface ListBoxState {
  readonly selected: string | undefined;
  readonly onSelect: (value: string) => void;
}

const ListBoxContext = createContext<ListBoxState>({
  selected: undefined,
  onSelect: () => undefined,
});

const listKeyTargets: Readonly<
  Record<
    string,
    (options: HTMLElement[], index: number) => HTMLElement | undefined
  >
> = {
  ArrowDown: (options, index) =>
    options[Math.min(index + 1, options.length - 1)],
  ArrowUp: (options, index) => options[Math.max(index - 1, 0)],
  Home: options => options[0],
  End: options => options.at(-1),
};

function enabledOptions(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(OPTION)];
}

export interface ListBoxProps {
  /** The list name for assistive technology, such as 예배 순서. */
  readonly label: string;
  readonly selected: string | undefined;
  readonly onSelect: (value: string) => void;
  /** The pick list in a dialog: 8px padding and rounded rows. */
  readonly inset?: boolean | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * A list that selects one row. Tab enters it once, on the selected row; the
 * up and down arrows, Home, and End move and select at once, skipping group
 * headers and disabled rows.
 */
export function ListBox({
  label,
  selected,
  onSelect,
  inset = false,
  className,
  children,
}: ListBoxProps): JSX.Element {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = listKeyTargets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const options = enabledOptions(event.currentTarget);
    const current =
      event.target instanceof Element ? event.target.closest(OPTION) : null;
    const index = options.findIndex(option => option === current);
    const next = target(options, index);
    if (next === undefined) return;
    next.focus();
    const value = next.dataset['value'];
    if (value !== undefined) onSelect(value);
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      enabledOptions(event.currentTarget)[0]?.focus();
    }
  };
  return (
    <ListBoxContext value={{selected, onSelect}}>
      <div
        role="listbox"
        aria-label={label}
        tabIndex={selected === undefined ? 0 : -1}
        className={classNames(styles.list, inset && styles.inset, className)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      >
        {children}
      </div>
    </ListBoxContext>
  );
}

export interface ListRowProps {
  /** The value the list reports when this row is selected. */
  readonly value: string;
  readonly title: string;
  /** A 16px type icon, such as `song`. */
  readonly icon?: string | undefined;
  /** Extra information at the right end, such as 9장 or 5:00. */
  readonly meta?: string | undefined;
  /** The second line of a two-line item, such as a date and a count. */
  readonly sub?: readonly string[] | undefined;
  /** On the screens now: a LIVE badge replaces the extra information. */
  readonly live?: boolean | undefined;
  /** A 예배 순서 item that has already passed. */
  readonly done?: boolean | undefined;
  /** The reason for a problem, such as 미디어 파일 없음; draws a warning icon. */
  readonly warning?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text for the row, such as the reason it is disabled. */
  readonly reason?: string | undefined;
  /** A control at the end of the row; its clicks don't select the row. */
  readonly end?: ReactNode;
}

function rowState(
  live: boolean,
  done: boolean,
  warning: boolean,
): string | undefined {
  const states = [live && 'live', done && 'done', warning && 'warning'].filter(
    state => typeof state === 'string',
  );
  return states.length === 0 ? undefined : states.join(' ');
}

function WarningMark({reason}: {readonly reason: string}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text: reason});
  return (
    <span
      {...targetProps}
      className={styles.warn}
      aria-label={reason}
      role="img"
    >
      <Icon name="warning" size={WARN_ICON_SIZE} />
      {tooltip}
    </span>
  );
}

/** Keeps clicks and keys on an end control from selecting the row. */
function RowEnd({children}: {readonly children: ReactNode}): JSX.Element {
  return (
    <span
      className={styles.end}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      {children}
    </span>
  );
}

function RowContent({
  props,
  titleId,
}: {
  readonly props: ListRowProps;
  readonly titleId: string;
}): JSX.Element {
  const {icon, title, meta, sub, live = false, warning, end} = props;
  const titleText = (
    <TruncatedText id={titleId} text={title} className={styles.title} />
  );
  return (
    <>
      {icon === undefined ? null : (
        <Icon name={icon} size={ROW_ICON_SIZE} className={styles.icon} />
      )}
      {sub === undefined ? (
        titleText
      ) : (
        <span className={styles.lines}>
          {titleText}
          <span className={styles.sub}>
            {sub.map(part => (
              <span key={part}>{part}</span>
            ))}
          </span>
        </span>
      )}
      {warning === undefined ? null : <WarningMark reason={warning} />}
      {live ? <LiveBadge /> : null}
      {live || meta === undefined ? null : (
        <span className={styles.meta}>{meta}</span>
      )}
      {end === undefined ? null : <RowEnd>{end}</RowEnd>}
    </>
  );
}

/**
 * One row of a `ListBox`: a 30px row, or a 44px two-line item with `sub`.
 * A click or Space selects it.
 */
export function ListRow(props: ListRowProps): JSX.Element {
  const {
    value,
    sub,
    live = false,
    done = false,
    warning,
    disabled = false,
  } = props;
  const {selected, onSelect} = useContext(ListBoxContext);
  const titleId = useId();
  const {targetProps, tooltip} = useTooltip(titleTooltip(props.reason));
  const isSelected = selected === value;
  const select = (): void => onSelect(value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    select();
  };
  return (
    <div
      {...targetProps}
      role="option"
      aria-selected={isSelected}
      aria-labelledby={titleId}
      aria-disabled={disabled ? true : undefined}
      data-value={value}
      data-state={rowState(live, done, warning !== undefined)}
      tabIndex={isSelected ? 0 : -1}
      className={classNames(styles.row, sub !== undefined && styles.double)}
      onClick={pressHandler(disabled, select)}
      onKeyDown={onKeyDown}
    >
      <RowContent props={props} titleId={titleId} />
      {tooltip}
    </div>
  );
}

export interface ListActionRowProps {
  readonly title: string;
  readonly icon?: string | undefined;
  readonly meta?: string | undefined;
  /** For an item that turns on and off, such as a logo screen. */
  readonly pressed?: boolean | undefined;
  readonly onPress: () => void;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the row is disabled. */
  readonly reason?: string | undefined;
}

/**
 * A row that runs at once on a click, as in 퀵 실행. An item that turns on
 * and off reports it with `aria-pressed` and a `live` bar on the left.
 */
export function ListActionRow({
  title,
  icon,
  meta,
  pressed,
  onPress,
  disabled = false,
  reason,
}: ListActionRowProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason));
  return (
    <>
      <button
        {...targetProps}
        type="button"
        aria-pressed={pressed}
        aria-disabled={disabled ? true : undefined}
        className={styles.row}
        onClick={pressHandler(disabled, onPress)}
      >
        {icon === undefined ? null : (
          <Icon name={icon} size={ROW_ICON_SIZE} className={styles.icon} />
        )}
        <TruncatedText text={title} className={styles.title} />
        {meta === undefined ? null : (
          <span className={styles.meta}>{meta}</span>
        )}
      </button>
      {tooltip}
    </>
  );
}

/** A named group of rows; its header can't be selected. */
export function ListGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={styles.groupRows}>
      <div id={labelId} className={styles.group}>
        {label}
      </div>
      {children}
    </div>
  );
}

/** The dashed box of a 틀 cell that isn't filled yet: 찬양 … 빈 자리. */
export function ListSlotBox({
  icon,
  label,
}: {
  readonly icon?: string | undefined;
  readonly label: string;
}): JSX.Element {
  return (
    <span className={styles.slot}>
      {icon === undefined ? null : (
        <Icon name={icon} size={ROW_ICON_SIZE} className={styles.icon} />
      )}
      <span className={styles.title}>{label}</span>
      <span className={styles.slotMark}>{SLOT_MARK}</span>
    </span>
  );
}

/** A row that holds only an empty slot box. */
export function ListSlot({
  icon,
  label,
}: {
  readonly icon?: string | undefined;
  readonly label: string;
}): JSX.Element {
  return (
    <div className={styles.row}>
      <ListSlotBox icon={icon} label={label} />
    </div>
  );
}

/**
 * The drop position between two rows while dragging. Set
 * `--list-insert-cut` to the surface color where it isn't `bg-panel`.
 */
export function ListInsertLine(): JSX.Element {
  return <div className={styles.insert} aria-hidden="true" />;
}

/** The row that follows the pointer while dragging from the library. */
export function ListDragGhost({
  icon,
  title,
  adding = false,
}: {
  readonly icon?: string | undefined;
  readonly title: string;
  /** Over a place where it can be dropped: adds the plus circle. */
  readonly adding?: boolean | undefined;
}): JSX.Element {
  return (
    <div className={classNames(styles.row, styles.ghost)} aria-hidden="true">
      {icon === undefined ? null : (
        <Icon name={icon} size={ROW_ICON_SIZE} className={styles.icon} />
      )}
      <span className={styles.title}>{title}</span>
      {adding ? (
        <span className={styles.add}>
          <Icon name="plus" size={ADD_ICON_SIZE} />
        </span>
      ) : null}
    </div>
  );
}
