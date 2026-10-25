import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type {LabelColor} from '@shared/colors';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {labelInk} from './labelInk';
import {hasModifier, isAltOnly} from './modifierKeys';
import {useTooltip} from './Tooltip';
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

export interface ArrangementStripProps {
  /** The strip name, such as 구성. */
  readonly label: string;
  readonly chips: readonly ArrangementChip[];
  readonly selected: number | undefined;
  /** The chip of the group that is on the screens now. */
  readonly live?: number | undefined;
  readonly onSelect: (index: number) => void;
  /** Alt + Left or Right asks to move a chip one place. */
  readonly onMove: (from: number, to: number) => void;
  /** Delete asks to take the 슬라이드 at that place out of the 구성. */
  readonly onRemove: (index: number) => void;
  /** The insert button asks to open the 이름표 menu below it. */
  readonly onInsert: (button: HTMLElement) => void;
  /** Draws the drop position before this chip while dragging. */
  readonly dropIndex?: number | undefined;
  /** The chip being dragged. */
  readonly draggingIndex?: number | undefined;
}

type StripKey = (index: number, count: number) => number;

const selectKeys: Readonly<Record<string, StripKey>> = {
  ArrowLeft: index => Math.max(index - 1, 0),
  ArrowRight: (index, count) => Math.min(index + 1, count - 1),
  Home: () => 0,
  End: (_index, count) => count - 1,
};

const moveKeys: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

interface ChipKeyActions {
  readonly count: number;
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
  const {count, select, onMove, onRemove} = actions;
  const step = moveKeys[event.key];
  if (step !== undefined && isAltOnly(event)) {
    const to = index + step;
    if (to >= 0 && to < count) onMove(index, to);
    return true;
  }
  if (hasModifier(event)) return false;
  if (event.key === 'Delete') {
    onRemove(index);
    return true;
  }
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
  label,
  chips,
  selected,
  live,
  onSelect,
  onMove,
  onRemove,
  onInsert,
  dropIndex,
  draggingIndex,
}: ArrangementStripProps): JSX.Element {
  const chipElements = useRef<Array<HTMLButtonElement | null>>([]);
  const insertButton = useRef<HTMLButtonElement>(null);
  const insertTooltip = useTooltip({text: INSERT_LABEL});
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
  const remove = (index: number): void => {
    const remaining = chips.length - 1;
    const next = chipAfterRemoval(index, remaining);
    focusAfterRemoval({remainingCount: remaining, chipOrInsert: next});
    onRemove(index);
    if (next !== null) onSelect(next);
  };
  const onKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    const actions = {count: chips.length, select, onMove, onRemove: remove};
    if (handleChipKey(event, index, actions)) event.preventDefault();
  };

  return (
    <div className={styles.strip}>
      <div
        role="listbox"
        aria-label={label}
        aria-orientation="horizontal"
        className={styles.chips}
      >
        {chips.map((chip, index) => (
          <ChipSlot
            key={chip.key}
            chip={chip}
            showDrop={dropIndex === index}
            selected={index === selected}
            live={index === live}
            dragging={index === draggingIndex}
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
      <button
        {...insertTooltip.targetProps}
        ref={insertButton}
        type="button"
        aria-label={INSERT_LABEL}
        className={styles.add}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          onInsert(event.currentTarget)
        }
      >
        <Icon name="plus" size={ADD_ICON_SIZE} />
      </button>
      {insertTooltip.tooltip}
    </div>
  );
}

interface ChipSlotProps {
  readonly chip: ArrangementChip;
  readonly showDrop: boolean;
  readonly selected: boolean;
  readonly live: boolean;
  readonly dragging: boolean;
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
  readonly chip: ArrangementChip;
  readonly selected: boolean;
  readonly live: boolean;
  readonly dragging: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLButtonElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function LabelChip({
  chip,
  selected,
  live,
  dragging,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: LabelChipProps): JSX.Element {
  return (
    <button
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
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <Icon name="grip" size={GRIP_SIZE} className={styles.grip} />
      {chipText(chip)}
    </button>
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
}

/**
 * The small 22px 이름표 left of a lyric block or in a list row. As a picker,
 * it is a button with a down arrow that opens the 이름표 menu.
 */
export function LabelTag({name, color, picker}: LabelTagProps): JSX.Element {
  if (picker === undefined) {
    return (
      <span data-color={color} style={labelInk(color)} className={styles.tag}>
        <span className={styles.tagName}>{name}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={picker.expanded}
      data-color={color}
      style={labelInk(color)}
      className={classNames(styles.tag, styles.picker)}
      onClick={event => picker.onOpen(event.currentTarget)}
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
