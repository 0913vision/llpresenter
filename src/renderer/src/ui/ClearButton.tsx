import {createContext, useContext, type JSX, type ReactNode} from 'react';
import type {ClearTarget} from '@core/live/commands';
import {classNames} from './classNames';
import {Icon, type IconSize} from './Icon';
import {useButtonPress} from './press';
import {useTooltip, withTooltipProps} from './Tooltip';
import styles from './ClearButton.module.css';

const ROW_NAME = '지우기';
const UNDO_NAME = '되돌림';
const UNDO_LABEL = '되돌리기';
const ICON_SIZE: IconSize = 18;
const COMPACT_ICON_SIZE: IconSize = 16;

interface ClearLook {
  readonly name: string;
  readonly icon: string;
  readonly shortcut: string;
}

const clearLooks: Readonly<Record<ClearTarget, ClearLook>> = {
  all: {name: '모두', icon: 'layers', shortcut: 'F1'},
  slide: {name: '가사', icon: 'text', shortcut: 'F2'},
  media: {name: '미디어', icon: 'image', shortcut: 'F3'},
  prop: {name: '그래픽', icon: 'prop', shortcut: 'F4'},
  audio: {name: '오디오', icon: 'audio', shortcut: 'F5'},
  message: {name: '메시지', icon: 'msg', shortcut: 'F6'},
  notice: {name: '공지', icon: 'notice', shortcut: 'F7'},
};

/** The one-word name of a layer on its 지우기 button. */
export function clearName(layer: ClearTarget): string {
  return clearLooks[layer].name;
}

/** The name of a 지우기 button, as its tooltip and `aria-label` say it. */
export function clearLabel(layer: ClearTarget): string {
  return `${clearName(layer)} 지우기`;
}

/** The default key of a 지우기 button, F1 to F7. */
export function defaultClearShortcut(layer: ClearTarget): string {
  return clearLooks[layer].shortcut;
}

const CompactRow = createContext(false);

/**
 * The 지우기 row of the 진행 workspace (`ll-clear-row`): the 지우기 buttons in
 * their order, then optional 되돌림. `compact` is the narrow window form, with
 * icons only and the names in the tooltips.
 */
export function ClearRow({
  compact = false,
  children,
}: {
  readonly compact?: boolean | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={ROW_NAME}
      className={classNames(styles.row, compact && styles.compact)}
    >
      <CompactRow value={compact}>{children}</CompactRow>
    </div>
  );
}

interface ControlProps {
  readonly name: string;
  readonly icon: string;
  readonly label: string;
  readonly shortcut: string | undefined;
  readonly available: boolean;
  readonly onPress: () => void;
  readonly className?: string | undefined;
}

function ClearControl(props: ControlProps): JSX.Element {
  const {name, icon, label, shortcut, available, onPress} = props;
  const compact = useContext(CompactRow);
  const {targetProps, tooltip} = useTooltip({text: label, shortcut});
  const {onBlur: pressBlur, ...press} = useButtonPress<HTMLButtonElement>({
    disabled: !available,
    onPress,
  });
  return (
    <>
      <button
        {...withTooltipProps({onBlur: pressBlur}, targetProps)}
        type="button"
        aria-label={label}
        aria-disabled={available ? undefined : true}
        data-state={available ? undefined : 'off'}
        className={classNames(styles.button, props.className)}
        {...press}
      >
        <Icon name={icon} size={compact ? COMPACT_ICON_SIZE : ICON_SIZE} />
        <span className={styles.label}>{name}</span>
      </button>
      {tooltip}
    </>
  );
}

export interface ClearButtonProps {
  readonly layer: ClearTarget;
  /** Whether that layer, or for `all` any layer, is on the screens now. */
  readonly active: boolean;
  readonly onClear: () => void;
  /** The current key, as the shortcut table writes it; F1 to F7 by default. */
  readonly shortcut?: string | undefined;
}

/**
 * Takes one layer, or every layer, off the screens at once. With nothing to
 * clear it draws the off state and its press and key do nothing.
 */
export function ClearButton({
  layer,
  active,
  onClear,
  shortcut = defaultClearShortcut(layer),
}: ClearButtonProps): JSX.Element {
  const look = clearLooks[layer];
  return (
    <ClearControl
      name={look.name}
      icon={look.icon}
      label={clearLabel(layer)}
      shortcut={shortcut}
      available={active}
      onPress={onClear}
      className={layer === 'all' ? styles.all : undefined}
    />
  );
}

export interface ClearUndoProps {
  /** Whether a 지우기 can be undone; only the last one can. */
  readonly available: boolean;
  readonly onUndo: () => void;
  /** An explicitly assigned key; clear undo has no default shortcut. */
  readonly shortcut?: string | undefined;
}

/** 되돌림, after the divider at the end of the 지우기 row. */
export function ClearUndo({
  available,
  onUndo,
  shortcut,
}: ClearUndoProps): JSX.Element {
  return (
    <>
      <span aria-hidden="true" className={styles.divider} />
      <ClearControl
        name={UNDO_NAME}
        icon="undo"
        label={UNDO_LABEL}
        shortcut={shortcut}
        available={available}
        onPress={onUndo}
        className={styles.undo}
      />
    </>
  );
}
