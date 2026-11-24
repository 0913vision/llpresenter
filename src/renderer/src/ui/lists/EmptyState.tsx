import type {JSX, ReactNode} from 'react';
import styles from './EmptyState.module.css';

/**
 * What a list or grid shows when it has no rows: a short "<noun> 없음" in the
 * quiet text color, and, when there is one, the button that fills it. The
 * words are the app's own labels; a sentence of explanation is not used.
 */
export function EmptyState({
  text,
  action,
}: {
  readonly text: string;
  readonly action?: ReactNode;
}): JSX.Element {
  return (
    <div role="status" className={styles.empty}>
      <span>{text}</span>
      {action}
    </div>
  );
}
