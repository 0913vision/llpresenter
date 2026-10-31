import {useEffect, useState, type JSX} from 'react';
import {Icon, useTooltip} from '@renderer/ui';
import {useButtonPress} from '@renderer/ui/press';
import {withTooltipProps} from '@renderer/ui/Tooltip';
import {
  clearLayer,
  undoClear,
  useCanUndo,
  useSomethingToClear,
  useClearRestores,
  toggleItem,
} from '@renderer/session/clear';
import {useLive} from '@renderer/session/live';
import {clearButtons, type ClearButtonSpec} from '@core/live/clear';
import styles from './ClearRow.module.css';

function ItemOffButton({compact}: {readonly compact: boolean}): JSX.Element {
  const hasItem = useLive(view => view.state?.themeItem != null);
  const restores = useLive(view => view.state?.canRestoreItem ?? false);
  const active = hasItem || restores;
  const name = restores ? '항목 복원' : '항목 끄기';
  const {targetProps, tooltip} = useTooltip({
    text: name,
    command: 'item.stop',
  });
  const {onBlur: pressBlur, ...press} = useButtonPress<HTMLButtonElement>({
    disabled: !active,
    onPress: toggleItem,
  });
  return (
    <>
      <button
        {...withTooltipProps({onBlur: pressBlur}, targetProps)}
        type="button"
        className={styles.button}
        aria-label={name}
        aria-pressed={restores}
        aria-disabled={!active}
        data-state={active ? undefined : 'off'}
        {...press}
      >
        <Icon name="slides" size={compact ? 16 : 18} />
        {compact ? null : <span className={styles.label}>항목</span>}
      </button>
      {tooltip}
    </>
  );
}

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
    command: spec.command,
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
  const {targetProps, tooltip} = useTooltip({
    text: '되돌리기',
    command: 'clear.undo',
  });
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
      <ItemOffButton compact={compact} />
      {clearButtons.map(spec => (
        <ClearButton key={spec.target} spec={spec} compact={compact} />
      ))}
      <UndoControls compact={compact} />
    </div>
  );
}
