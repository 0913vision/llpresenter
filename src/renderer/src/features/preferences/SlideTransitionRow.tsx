import type {JSX} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import {
  SlideTransitionControl,
  type SlideTransitionChange,
} from '@renderer/ui/SlideTransitionControl';
import styles from './SlideTransitionRow.module.css';

export function SlideTransitionRow({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: SlideTransition;
  readonly disabled: boolean;
  readonly onChange: (update: SlideTransitionChange) => void;
}): JSX.Element {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <SlideTransitionControl
        label={label}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
