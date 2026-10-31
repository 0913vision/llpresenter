import {memo, type JSX, type ReactNode} from 'react';
import type {MacroColor} from '@core/labels/colors';
import {classNames} from './classNames';
import {hasIcon, Icon} from './Icon';
import {labelInk} from './labelInk';
import type {MenuAnchor} from './Menu';
import {gridMoves, rowMoves, TileList} from './TileList';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
import {useButtonPress} from './press';
import styles from './MacroTile.module.css';

const TILE_ICON_SIZE = 28;
const ROW_ICON_SIZE = 14;
const CLOCK_ICON_SIZE = 12;
const NEW_ICON_SIZE = 24;
const DEFAULT_MACRO_ICON = 'macro';

function macroIcon(icon: string): string {
  return hasIcon(icon) ? icon : DEFAULT_MACRO_ICON;
}
const NEW_MACRO = '새 매크로';
const ONE_COLUMN = 1;

/**
 * When a 매크로 runs on its own: once after the app starts (시작할 때 실행),
 * or at a time of day such as 10:30, which version 1 reserves
 * (docs/spec/07, "Scheduled 매크로").
 */
export type MacroSchedule =
  {readonly kind: 'startup'} | {readonly kind: 'time'; readonly time: string};

/** The short schedule of the list row meta, such as 10:30 or 시작할 때. */
export function scheduleMeta(schedule: MacroSchedule): string {
  switch (schedule.kind) {
    case 'startup':
      return '시작할 때';
    case 'time':
      return schedule.time;
  }
}

/** The schedule as the tooltip and the name say it, such as 10:30에 실행. */
export function scheduleText(schedule: MacroSchedule): string {
  switch (schedule.kind) {
    case 'startup':
      return '시작할 때 실행';
    case 'time':
      return `${schedule.time}에 실행`;
  }
}

/** The accessible name: the 매크로 name, then its schedule. */
export function macroName(name: string, schedule?: MacroSchedule): string {
  return schedule === undefined ? name : `${name}, ${scheduleText(schedule)}`;
}

/** The props that a grid tile and a list row of a 매크로 share. */
export interface MacroProps {
  /** A short noun for a moment in the 예배 순서, such as 찬양. */
  readonly name: string;
  /** The icon file name, such as `song`. */
  readonly icon: string;
  readonly color: MacroColor;
  /** The 매크로 that ran last; it keeps a white ring. */
  readonly lastRun?: boolean | undefined;
  /** Being edited or under its right-click menu. */
  readonly selected?: boolean | undefined;
  readonly schedule?: MacroSchedule | undefined;
}

function macroState(lastRun: boolean): string | undefined {
  return lastRun ? 'last-run' : undefined;
}

/** A 매크로 in the grid view: a 64px color tile with the name under it. */
export const MacroTile = memo((props: MacroProps): JSX.Element => {
  const {name, icon, color, lastRun = false, selected = false} = props;
  const {schedule} = props;
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(
      schedule === undefined ? undefined : macroName(name, schedule),
    ),
  );
  return (
    <button
      {...targetProps}
      type="button"
      role="option"
      aria-label={macroName(name, schedule)}
      aria-selected={selected}
      data-color={color}
      data-state={macroState(lastRun)}
      className={styles.macro}
    >
      <span className={styles.tile} style={labelInk(color)}>
        <Icon name={macroIcon(icon)} size={TILE_ICON_SIZE} />
        {schedule === undefined ? null : (
          <span className={styles.clock}>
            <Icon name="clock" size={CLOCK_ICON_SIZE} />
          </span>
        )}
      </span>
      <span className={styles.name}>{name}</span>
      {tooltip}
    </button>
  );
});

export interface MacroRowProps extends MacroProps {
  readonly actionCount: number;
}

/** A 매크로 in the list view: a 30px row with a 20px color cell. */
export const MacroRow = memo((props: MacroRowProps): JSX.Element => {
  const {name, icon, color, lastRun = false, selected = false} = props;
  const {schedule, actionCount} = props;
  return (
    <button
      type="button"
      role="option"
      aria-label={macroName(name, schedule)}
      aria-selected={selected}
      data-color={color}
      data-state={macroState(lastRun)}
      className={styles.row}
    >
      <span className={styles.swatch} style={labelInk(color)}>
        <Icon name={macroIcon(icon)} size={ROW_ICON_SIZE} />
      </span>
      <span className={styles.rowName}>{name}</span>
      {schedule === undefined ? null : (
        <span className={styles.meta}>
          <Icon name="clock" size={CLOCK_ICON_SIZE} />
          {scheduleMeta(schedule)}
        </span>
      )}
      <span className={styles.meta}>{`동작 ${actionCount}개`}</span>
    </button>
  );
});

/** The props that the 매크로 grid and the 매크로 list share. */
export interface MacroListProps {
  /** The list name for assistive technology, such as 매크로. */
  readonly label: string;
  /** The index of the 매크로 being edited or under its right-click menu. */
  readonly selected: number | undefined;
  /** A click, Enter, or Space runs that 매크로 at once. */
  readonly onRun: (index: number) => void;
  /** A right-click, Shift F10, or the Menu key opens the 매크로 menu. */
  readonly onMenu: (index: number, anchor: MenuAnchor) => void;
  readonly className?: string | undefined;
  /** The `MacroTile` or `MacroRow` items, in order. */
  readonly children: ReactNode;
}

export interface MacroGridProps extends MacroListProps {
  /** Adds the 새 매크로 slot at the end of the grid. */
  readonly onNew?: (() => void) | undefined;
  readonly newDisabledReason?: string | undefined;
}

function NewMacro({
  onNew,
  disabledReason,
}: {
  readonly onNew: () => void;
  readonly disabledReason: string | undefined;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(disabledReason));
  const {onBlur: pressBlur, ...press} = useButtonPress({
    disabled: disabledReason !== undefined,
    onPress: onNew,
  });
  return (
    <>
      <button
        {...withTooltipProps({onBlur: pressBlur}, targetProps)}
        {...press}
        type="button"
        aria-label={NEW_MACRO}
        aria-disabled={disabledReason !== undefined ? true : undefined}
        className={classNames(styles.macro, styles.new)}
      >
        <span className={styles.tile}>
          <Icon name="plus" size={NEW_ICON_SIZE} />
        </span>
        <span className={styles.name}>{NEW_MACRO}</span>
      </button>
      {tooltip}
    </>
  );
}

/**
 * The grid view of the 매크로 tab (`ll-macro-grid`). The arrow keys move
 * keyboard focus only; the selection marks the 매크로 being edited. In 진행, a
 * click runs a 매크로 without taking keyboard focus.
 */
export function MacroGrid(props: MacroGridProps): JSX.Element {
  // NOTE(0913vision): The 새 매크로 slot is a grid cell but not an option, so
  // the listbox wraps only the tiles and passes its box to the grid.
  return (
    <div className={classNames(styles.grid, props.className)}>
      <TileList
        label={props.label}
        moves={gridMoves}
        columns="auto"
        spaceKey="press"
        arrowsMove="focus"
        selected={props.selected}
        onActivate={props.onRun}
        onMenu={props.onMenu}
        className={styles.options}
      >
        {props.children}
      </TileList>
      {props.onNew === undefined ? null : (
        <NewMacro
          onNew={props.onNew}
          disabledReason={props.newDisabledReason}
        />
      )}
    </div>
  );
}

/** The list view of the 매크로 tab: one 30px row per 매크로. */
export function MacroList(props: MacroListProps): JSX.Element {
  return (
    <TileList
      label={props.label}
      moves={rowMoves}
      columns={ONE_COLUMN}
      spaceKey="press"
      arrowsMove="focus"
      selected={props.selected}
      onActivate={props.onRun}
      onMenu={props.onMenu}
      className={classNames(styles.list, props.className)}
    >
      {props.children}
    </TileList>
  );
}
