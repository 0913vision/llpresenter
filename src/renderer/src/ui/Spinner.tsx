import type {JSX} from 'react';
import styles from './Spinner.module.css';

/** Decorative progress indicator; its container supplies the accessible status. */
export function Spinner({
  size = 'md',
}: {
  readonly size?: 'sm' | 'md';
}): JSX.Element {
  return (
    <span aria-hidden="true" className={styles.spinner} data-size={size} />
  );
}
