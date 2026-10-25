import {
  createContext,
  memo,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {classNames} from './classNames';
import {clickFocusProps} from './clickFocus';
import {Icon} from './Icon';
import {hasModifier} from './modifierKeys';
import {pressHandler} from './press';
import {LiveBadge} from './StatusMarks';
import {titleTooltip, useTooltip} from './Tooltip';
import {TruncatedText} from './TruncatedText';
import type {Workspace} from './workspace';
import styles from './ListRow.module.css';

const ROW_ICON_SIZE = 16;
const WARN_ICON_SIZE = 14;
const ADD_ICON_SIZE = 12;
const SLOT_MARK = '빈 자리';
const ANY_OPTION = '[role="option"]';
const OPTION = '[role="option"]:not([aria-disabled="true"])';
const ACTIVATION_KEYS: ReadonlySet<string> = new Set([' ', 'Enter']);
const workspaceActivationKeys: Readonly<
  Record<Workspace, ReadonlySet<string>>
> = {
  show: new Set(['Enter']),
  prep: ACTIVATION_KEYS,
};

interface SelectionStore {
  readonly get: () => string | undefined;
  readonly set: (value: string | undefined) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

// NOTE(0913vision): Each row reads only whether it is the selected one, so a
// selection change redraws the old and the new selected row and no other.
function createSelectionStore(initial: string | undefined): SelectionStore {
  let selected = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => selected,
    set: value => {
      if (value === selected) return;
      selected = value;
      for (const listener of listeners) listener();
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface ListBoxState {
  readonly selection: SelectionStore;
  readonly onSelect: (value: string) => void;
  readonly workspace: Workspace;
}

const ListBoxContext = createContext<ListBoxState>({
  selection: createSelectionStore(undefined),
  onSelect: () => undefined,
  workspace: 'prep',
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

// NOTE(0913vision): Tab enters the list once, on the selected row or the
// first row, and Shift Tab leaves it; the list itself never takes focus.
function keepOneTabStop(list: HTMLElement, selected: string | undefined): void {
  const enabled = enabledOptions(list);
  const stop =
    enabled.find(option => option.dataset['value'] === selected) ?? enabled[0];
  for (const option of list.querySelectorAll<HTMLElement>(ANY_OPTION)) {
    option.tabIndex = option === stop ? 0 : -1;
  }
}

function useListBoxState(
  selected: string | undefined,
  onSelect: (value: string) => void,
  workspace: Workspace,
): ListBoxState {
  const [selection] = useState(() => createSelectionStore(selected));
  const latestOnSelect = useRef(onSelect);
  useLayoutEffect(() => {
    latestOnSelect.current = onSelect;
    selection.set(selected);
  });
  return useMemo(
    () => ({
      selection,
      onSelect: (value: string) => latestOnSelect.current(value),
      workspace,
    }),
    [selection, workspace],
  );
}

function useOneTabStop(
  list: RefObject<HTMLDivElement | null>,
  selection: SelectionStore,
): void {
  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) return;
    const update = (): void => keepOneTabStop(element, selection.get());
    update();
    const observer = new MutationObserver(update);
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-disabled', 'data-value'],
    });
    const unsubscribe = selection.subscribe(update);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [list, selection]);
}

export interface ListBoxProps {
  /** The list name for assistive technology, such as 예배 순서. */
  readonly label: string;
  readonly selected: string | undefined;
  readonly onSelect: (value: string) => void;
  /** The pick list in a dialog: 8px padding and rounded rows. */
  readonly inset?: boolean | undefined;
  /**
   * `show` for the 예배 순서 list of 진행, where Space goes on to 다음 슬라이드 and
   * only Enter selects; `prep` (the default) everywhere else, dialogs included.
   * 진행 keeps keyboard focus without drawing a row focus outline.
   */
  readonly workspace?: Workspace | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * A list that selects one row. Tab enters it once, on the selected row; the
 * up and down arrows, Home, and End move and select at once, skipping group
 * headers and disabled rows. Keys with Ctrl, Alt, Shift, or the Windows key
 * pass on to the window.
 */
export function ListBox({
  label,
  selected,
  onSelect,
  inset = false,
  workspace = 'prep',
  className,
  children,
}: ListBoxProps): JSX.Element {
  const state = useListBoxState(selected, onSelect, workspace);
  const listRef = useRef<HTMLDivElement>(null);
  useOneTabStop(listRef, state.selection);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = listKeyTargets[event.key];
    if (target === undefined || hasModifier(event)) return;
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
  return (
    <ListBoxContext value={state}>
      <div
        {...clickFocusProps}
        ref={listRef}
        role="listbox"
        data-workspace={workspace}
        aria-label={label}
        className={classNames(styles.list, inset && styles.inset, className)}
        onKeyDown={onKeyDown}
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
  /** Extra information at the right end, such as 슬라이드 9개 or 5:00. */
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

function isRowKey(key: string): boolean {
  return ACTIVATION_KEYS.has(key) || Object.hasOwn(listKeyTargets, key);
}

function RowEnd({children}: {readonly children: ReactNode}): JSX.Element {
  return (
    <span
      className={styles.end}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (isRowKey(event.key) && !hasModifier(event)) event.stopPropagation();
      }}
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
export const ListRow = memo((props: ListRowProps): JSX.Element => {
  const {
    value,
    sub,
    live = false,
    done = false,
    warning,
    disabled = false,
  } = props;
  const {selection, onSelect, workspace} = useContext(ListBoxContext);
  const isSelected = useSyncExternalStore(
    selection.subscribe,
    () => selection.get() === value,
  );
  const titleId = useId();
  const {targetProps, tooltip} = useTooltip(titleTooltip(props.reason));
  const select = (): void => onSelect(value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || hasModifier(event)) return;
    if (!workspaceActivationKeys[workspace].has(event.key)) return;
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
      className={classNames(styles.row, sub !== undefined && styles.double)}
      onClick={pressHandler(disabled, select)}
      onKeyDown={onKeyDown}
    >
      <RowContent props={props} titleId={titleId} />
      {tooltip}
    </div>
  );
});

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
