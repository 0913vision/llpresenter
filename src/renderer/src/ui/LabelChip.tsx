import {useCommandShortcuts} from './commandDispatcher';
import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type {LabelColor} from '@core/labels/colors';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {labelInk} from './labelInk';
import {hasModifier} from './modifierKeys';
import {useButtonPress} from './press';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './LabelChip.module.css';

const GRIP_SIZE = 14;
const ADD_ICON_SIZE = 14;
const CHEVRON_SIZE = 12;
const INSERT_LABEL = '슬라이드 넣기';
const PICKER_PLACEHOLDER = '이름표';

/** One group of 슬라이드 in a 구성: its 이름표 name and color, or its number. */
export interface ArrangementChip {
  /** A stable key for the chip, unique within the strip. */
  readonly key: string;
  /** The 이름표 name, such as 후렴; `undefined` for a group without one. */
  readonly name: string | undefined;
  readonly color: LabelColor;
  /** The group number, shown when the group has no 이름표. */
  readonly number: number;
}

function chipText(chip: ArrangementChip): string {
  return chip.name ?? String(chip.number);
}

interface ArrangementStripBaseProps {
  /** The strip name, such as 구성. */
  readonly label: string;
  readonly chips: readonly ArrangementChip[];
  readonly selected: number | undefined;
  /** The chip of the group that is on the screens now. */
  readonly live?: number | undefined;
  readonly onSelect: (index: number) => void;
  readonly insertLabel?: string;
  /** Draws the drop position before this chip while dragging. */
  readonly dropIndex?: number | undefined;
  /** The chip being dragged. */
  readonly draggingIndex?: number | undefined;
  /**
   * Why the order can't change, such as while 기본 is chosen. The chips then
   * only select, and the reason shows in their tooltips.
   */
  readonly readOnlyReason?: string | undefined;
}

/** Select mode has no order editing callbacks, controls or drag grips. */
export type ArrangementStripProps = ArrangementStripBaseProps &
  (
    | {
        readonly mode?: 'edit';
        readonly onMove: (from: number, to: number) => void;
        readonly onRemove: (index: number) => void;
        readonly onInsert: (button: HTMLElement) => void;
      }
    | {
        readonly mode: 'select';
        readonly onMove?: never;
        readonly onRemove?: never;
        readonly onInsert?: never;
      }
  );

type StripKey = (index: number, count: number) => number;

const selectKeys: Readonly<Record<string, StripKey>> = {
  ArrowLeft: index => Math.max(index - 1, 0),
  ArrowRight: (index, count) => Math.min(index + 1, count - 1),
  Home: () => 0,
  End: (_index, count) => count - 1,
};

interface ChipKeyActions {
  readonly count: number;
  readonly readOnly: boolean;
  readonly select: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (index: number) => void;
}

interface PendingFocus {
  readonly remainingCount: number;
  readonly chipOrInsert: number | null;
}

function chipAfterRemoval(index: number, remaining: number): number | null {
  return remaining === 0 ? null : Math.min(index, remaining - 1);
}

function useFocusAfterRemoval(
  count: number,
  focus: (index: number | null) => void,
): (pending: PendingFocus) => void {
  const pendingRef = useRef<PendingFocus | null>(null);
  const focusPending = useEffectEvent(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.remainingCount === count) focus(pending.chipOrInsert);
  });
  useLayoutEffect(() => {
    focusPending();
  }, [count]);
  return pending => {
    pendingRef.current = pending;
  };
}

function handleChipKey(
  event: KeyboardEvent,
  index: number,
  actions: ChipKeyActions,
): boolean {
  const {count, select} = actions;
  if (hasModifier(event)) return false;
  const target = selectKeys[event.key];
  if (target === undefined) return false;
  select(target(index, count));
  return true;
}

/**
 * The 구성 strip: one chip per group in 슬라이드 order, then the insert button. The
 * arrow keys select chips, Alt + Left or Right moves the selected one, and
 * Delete takes it out. Dragging is left to the caller, which draws its state
 * with `dropIndex` and `draggingIndex`.
 */
export function ArrangementStrip({
  mode = 'edit',
  label,
  chips,
  selected,
  live,
  onSelect,
  onMove,
  onRemove,
  onInsert,
  insertLabel = INSERT_LABEL,
  dropIndex,
  draggingIndex,
  readOnlyReason,
}: ArrangementStripProps): JSX.Element {
  const chipElements = useRef<Array<HTMLButtonElement | null>>([]);
  const insertButton = useRef<HTMLButtonElement>(null);
  const focusAfterMove = useRef<number | null>(null);
  const readOnly = mode === 'select' || readOnlyReason !== undefined;
  const insertTooltip = useTooltip({text: readOnlyReason ?? insertLabel});
  const insertPress = useButtonPress<HTMLButtonElement>({
    disabled: readOnly,
    onPress: event => onInsert?.(event.currentTarget),
    onBlur: insertTooltip.targetProps.onBlur,
  });
  const tabStop = Math.min(selected ?? 0, chips.length - 1);
  const focusAfterRemoval = useFocusAfterRemoval(chips.length, index => {
    const target =
      index === null ? insertButton.current : chipElements.current[index];
    target?.focus();
  });

  const select = (index: number): void => {
    chipElements.current[index]?.focus();
    if (index !== selected) onSelect(index);
  };
  const move = (from: number, to: number): void => {
    focusAfterMove.current = to;
    onMove?.(from, to);
  };
  useLayoutEffect(() => {
    const target = focusAfterMove.current;
    if (target === null) return;
    focusAfterMove.current = null;
    chipElements.current[target]?.focus();
  });
  const remove = (index: number): void => {
    const remaining = chips.length - 1;
    const next = chipAfterRemoval(index, remaining);
    focusAfterRemoval({remainingCount: remaining, chipOrInsert: next});
    onRemove?.(index);
    if (next !== null) onSelect(next);
  };
  const ownsCommand = (event: globalThis.KeyboardEvent): boolean =>
    chipElements.current.some(
      element => element !== null && element === event.target,
    );
  const runCommand = (
    action: 'left' | 'right' | 'delete',
    event: globalThis.KeyboardEvent,
  ): void => {
    const index = chipElements.current.findIndex(
      element => element === event.target,
    );
    if (readOnly || index < 0) return;
    if (action === 'delete') {
      remove(index);
      return;
    }
    const to = index + (action === 'left' ? -1 : 1);
    if (to >= 0 && to < chips.length) move(index, to);
  };
  useCommandShortcuts([
    {
      id: 'arrangement.moveLeft',
      context: 'arrangement',
      when: ownsCommand,
      run: event => runCommand('left', event),
    },
    {
      id: 'arrangement.moveRight',
      context: 'arrangement',
      when: ownsCommand,
      run: event => runCommand('right', event),
    },
    {
      id: 'edit.delete',
      context: 'arrangement',
      when: ownsCommand,
      run: event => runCommand('delete', event),
    },
  ]);

  const onKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    const actions = {
      count: chips.length,
      readOnly,
      select,
      onMove: move,
      onRemove: remove,
    };
    if (handleChipKey(event, index, actions)) event.preventDefault();
  };

  return (
    <div className={styles.strip}>
      <div
        role="listbox"
        data-command-context="arrangement"
        aria-label={label}
        aria-orientation="horizontal"
        aria-readonly={readOnly ? true : undefined}
        className={styles.chips}
      >
        {chips.map((chip, index) => (
          <ChipSlot
            key={chip.key}
            chip={chip}
            mode={mode}
            showDrop={dropIndex === index}
            selected={index === selected}
            live={index === live}
            dragging={index === draggingIndex}
            reason={readOnlyReason}
            tabIndex={index === tabStop ? 0 : -1}
            elementRef={element => {
              chipElements.current[index] = element;
            }}
            onSelect={() => select(index)}
            onKeyDown={event => onKeyDown(index, event)}
          />
        ))}
        {dropIndex === chips.length ? <ChipDrop /> : null}
      </div>
      {mode === 'select' ? null : (
        <button
          {...insertTooltip.targetProps}
          {...insertPress}
          ref={insertButton}
          type="button"
          aria-label={insertLabel}
          aria-disabled={readOnly ? true : undefined}
          className={styles.add}
        >
          <Icon name="plus" size={ADD_ICON_SIZE} />
        </button>
      )}
      {insertTooltip.tooltip}
    </div>
  );
}

interface ChipSlotProps {
  readonly mode: 'edit' | 'select';
  readonly chip: ArrangementChip;
  readonly showDrop: boolean;
  readonly selected: boolean;
  readonly live: boolean;
  readonly dragging: boolean;
  readonly reason: string | undefined;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLButtonElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function ChipSlot({showDrop, chip, ...props}: ChipSlotProps): JSX.Element {
  return (
    <>
      {showDrop ? <ChipDrop /> : null}
      <LabelChip chip={chip} {...props} />
    </>
  );
}

function ChipDrop(): JSX.Element {
  return <span aria-hidden="true" className={styles.drop} />;
}

interface LabelChipProps {
  readonly mode: 'edit' | 'select';
  readonly chip: ArrangementChip;
  readonly selected: boolean;
  readonly live: boolean;
  readonly dragging: boolean;
  readonly reason: string | undefined;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLButtonElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function LabelChip({
  mode,
  chip,
  selected,
  live,
  dragging,
  reason,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: LabelChipProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason));
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: onSelect,
    onKeyDown,
    onBlur: targetProps.onBlur,
  });
  return (
    <>
      <button
        {...targetProps}
        {...press}
        ref={elementRef}
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={tabIndex}
        data-color={chip.color}
        data-state={live ? 'live' : undefined}
        data-dragging={dragging ? true : undefined}
        style={labelInk(chip.color)}
        className={styles.chip}
      >
        {mode === 'select' ? null : (
          <Icon name="grip" size={GRIP_SIZE} className={styles.grip} />
        )}
        {chipText(chip)}
      </button>
      {tooltip}
    </>
  );
}

export interface LabelTagProps {
  /** The 이름표 name; `undefined` when the 슬라이드 has none. */
  readonly name: string | undefined;
  readonly color: LabelColor;
  /** Makes it a button that opens the 이름표 menu. */
  readonly picker?:
    | {
        readonly expanded: boolean;
        readonly onOpen: (button: HTMLElement) => void;
      }
    | undefined;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * The small 22px 이름표 left of a lyric block or in a list row. As a picker,
 * it is a button with a down arrow that opens the 이름표 menu.
 */
export function LabelTag({
  name,
  color,
  picker,
  buttonRef,
}: LabelTagProps): JSX.Element {
  const press = useButtonPress<HTMLButtonElement>({
    disabled: picker === undefined,
    onPress: event => picker?.onOpen(event.currentTarget),
  });
  if (picker === undefined) {
    return (
      <span data-color={color} style={labelInk(color)} className={styles.tag}>
        <span className={styles.tagName}>{name}</span>
      </span>
    );
  }
  return (
    <button
      {...press}
      ref={buttonRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={picker.expanded}
      data-color={color}
      style={labelInk(color)}
      className={classNames(styles.tag, styles.picker)}
    >
      <span className={styles.tagName}>{name ?? PICKER_PLACEHOLDER}</span>
      <Icon name="down" size={CHEVRON_SIZE} />
    </button>
  );
}

/** A 10px color square next to an 이름표 name, as in the preview name row. */
export function LabelSwatch({
  color,
}: {
  readonly color: LabelColor;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-color={color}
      style={labelInk(color)}
      className={styles.swatch}
    />
  );
}
