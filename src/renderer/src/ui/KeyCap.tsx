import type {JSX, ReactNode} from 'react';
import {Icon} from './Icon';
import {withParticle} from './korean';
import {useTooltip} from './Tooltip';
import styles from './KeyCap.module.css';

const WARN_ICON_SIZE = 14;
const NO_SHORTCUT = '없음';

/**
 * Writes a shortcut as text, the same way in tooltips, menus, and the
 * shortcut table: `['Ctrl', 'Z']` becomes `Ctrl Z`.
 */
export function formatShortcut(keys: readonly string[]): string {
  return keys.join(' ');
}

/** The tooltip of a shortcut that another command also uses. */
export function conflictText(command: string): string {
  return `${command}${withParticle(command)} 겹침`;
}

/** A shortcut as it is, changed from its default, or in conflict. */
export type KeyComboState = 'default' | 'changed' | 'warning';

export interface KeyComboProps {
  /** Key names as Windows writes them: Ctrl, Alt, Shift, Space, F1, →. */
  readonly keys: readonly string[];
  readonly state?: KeyComboState | undefined;
  /** The command it conflicts with; shown in the tooltip of the warning. */
  readonly conflictWith?: string | undefined;
}

function ConflictMark({command}: {readonly command: string}): JSX.Element {
  const text = conflictText(command);
  const {targetProps, tooltip} = useTooltip({text});
  return (
    <span {...targetProps} role="img" aria-label={text} className={styles.warn}>
      <Icon name="warning" size={WARN_ICON_SIZE} />
      {tooltip}
    </span>
  );
}

/**
 * One shortcut drawn as keys. A conflict draws a `warning` outline and an
 * icon whose tooltip names the other command.
 */
export function KeyCombo({
  keys,
  state = 'default',
  conflictWith,
}: KeyComboProps): JSX.Element {
  const combo = (
    <span className={styles.combo} data-state={state}>
      {keys.map(key => (
        <kbd key={key} className={styles.key}>
          {key}
        </kbd>
      ))}
    </span>
  );
  if (state !== 'warning' || conflictWith === undefined) return combo;
  return (
    <span className={styles.list}>
      {combo}
      <ConflictMark command={conflictWith} />
    </span>
  );
}

/** The shortcuts of one command, or 없음 when it has none. */
export function KeyList({
  children,
}: {
  readonly children?: ReactNode;
}): JSX.Element {
  const empty =
    children === undefined ||
    children === null ||
    (Array.isArray(children) && children.length === 0);
  if (empty) return <span className={styles.empty}>{NO_SHORTCUT}</span>;
  return <span className={styles.list}>{children}</span>;
}

/** A shortcut as plain `text-3` text, sized by the text around it. */
export function KeyText({
  keys,
}: {
  readonly keys: readonly string[];
}): JSX.Element {
  return <span className={styles.text}>{formatShortcut(keys)}</span>;
}
