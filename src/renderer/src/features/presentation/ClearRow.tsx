import {useEffect, useState, type JSX} from 'react';
import {Icon, useTooltip} from '@renderer/ui';
import {
  clearLayer,
  undoClear,
  useCanUndo,
  useSomethingToClear,
  useClearRestores,
} from '@renderer/features/presentation/state/clear';
import {clearButtons, type ClearButtonSpec} from '@core/live/clear';
import styles from './ClearRow.module.css';

function ClearButton({
  spec,
  compact,
}: {
  readonly spec: ClearButtonSpec;
  readonly compact: boolean;
}): JSX.Element {
  const active = useSomethingToClear(spec.target);
  const restores = useClearRestores(spec.target);
  const name = `${spec.label} ${restores ? '복원' : '지우기'}`;
  const classes =
    spec.target === 'all' ? `${styles.button} ${styles.all}` : styles.button;
  const {targetProps, tooltip} = useTooltip({
    text: name,
    shortcut: spec.shortcut,
  });
  return (
    <>
      <button
        {...targetProps}
        type="button"
        className={classes}
        aria-label={name}
        aria-pressed={restores}
        aria-disabled={!active}
        data-state={active ? undefined : 'off'}
        onClick={() => clearLayer(spec.target)}
      >
        <Icon name={spec.icon} size={compact ? 16 : 18} />
        {compact ? null : <span className={styles.label}>{spec.label}</span>}
      </button>
      {tooltip}
    </>
  );
}

function UndoButton({compact}: {readonly compact: boolean}): JSX.Element {
  const canUndo = useCanUndo();
  const {targetProps, tooltip} = useTooltip({text: '되돌리기'});
  return (
    <>
      <button
        {...targetProps}
        type="button"
        className={`${styles.button} ${styles.undo}`}
        aria-label="되돌리기"
        aria-disabled={!canUndo}
        data-state={canUndo ? undefined : 'off'}
        onClick={undoClear}
      >
        <Icon name="undo" size={compact ? 16 : 18} />
        {compact ? null : <span className={styles.label}>되돌림</span>}
      </button>
      {tooltip}
    </>
  );
}

function UndoControls({
  compact,
}: {
  readonly compact: boolean;
}): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let stopped = false;
    api.preferences.get().then(
      preferences => {
        if (!stopped) setVisible(preferences.show.showClearUndoButton);
      },
      // NOTE(0913vision): Preload logs a failed read; keep the default hidden.
      () => undefined,
    );
    return () => {
      stopped = true;
    };
  }, []);
  if (!visible) return null;
  return (
    <>
      <span className={styles.divider} aria-hidden="true" />
      <UndoButton compact={compact} />
    </>
  );
}

/** The 지우기 row, with clear undo visible only when its preference is on. */
export function ClearRow({compact}: {readonly compact: boolean}): JSX.Element {
  return (
    <div
      role="group"
      aria-label="지우기"
      className={compact ? `${styles.row} ${styles.compact}` : styles.row}
    >
      {clearButtons.map(spec => (
        <ClearButton key={spec.target} spec={spec} compact={compact} />
      ))}
      <UndoControls compact={compact} />
    </div>
  );
}
