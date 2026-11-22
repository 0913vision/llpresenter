import type {JSX} from 'react';
import {Checkbox} from '@renderer/ui/Checkbox';
import styles from './EditorSlidePlate.module.css';

/** A list-only selection control over the slide picture. */
export function EditorSlideNumber({
  number,
  selected,
  onToggle,
}: {
  readonly number: number;
  readonly selected: boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  return (
    <span className={styles.number}>
      <Checkbox
        tabIndex={-1}
        className={styles.checkbox}
        aria-label={`슬라이드 ${number} 선택`}
        checked={selected}
        onChange={onToggle}
      />
    </span>
  );
}
