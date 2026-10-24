import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {
  clearLayer,
  undoClear,
  useCanUndo,
  useSomethingToClear,
} from '@renderer/state/clear';
import {clearButtons, UNDO_SHORTCUT, type ClearButtonSpec} from './clear';
import styles from './ClearRow.module.css';

function ClearButton({
  spec,
  compact,
}: {
  readonly spec: ClearButtonSpec;
  readonly compact: boolean;
}): JSX.Element {
  const active = useSomethingToClear(spec.target);
  const name = `${spec.label} 지우기`;
  const classes =
    spec.target === 'all' ? `${styles.button} ${styles.all}` : styles.button;
  return (
    <button
      type="button"
      className={classes}
      aria-label={name}
      aria-keyshortcuts={spec.shortcut}
      aria-disabled={!active}
      data-state={active ? undefined : 'off'}
      title={`${name} ${spec.shortcut}`}
      onClick={() => clearLayer(spec.target)}
    >
      <Icon name={spec.icon} size={compact ? 16 : 18} />
      {compact ? null : <span className={styles.label}>{spec.label}</span>}
    </button>
  );
}

/** The 지우기 row of the 진행 workspace: one button per layer, and 되돌림. */
export function ClearRow({compact}: {readonly compact: boolean}): JSX.Element {
  const canUndo = useCanUndo();
  return (
    <div
      role="group"
      aria-label="지우기"
      className={compact ? `${styles.row} ${styles.compact}` : styles.row}
    >
      {clearButtons.map(spec => (
        <ClearButton key={spec.target} spec={spec} compact={compact} />
      ))}
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.button} ${styles.undo}`}
        aria-label="되돌리기"
        aria-keyshortcuts="Control+Z"
        aria-disabled={!canUndo}
        data-state={canUndo ? undefined : 'off'}
        title={`되돌리기 ${UNDO_SHORTCUT}`}
        onClick={undoClear}
      >
        <Icon name="undo" size={compact ? 16 : 18} />
        {compact ? null : <span className={styles.label}>되돌림</span>}
      </button>
    </div>
  );
}
