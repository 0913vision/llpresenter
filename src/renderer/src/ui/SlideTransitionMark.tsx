import type {JSX} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import styles from './SlideTransitionMark.module.css';

/** A corner mark for an explicit effect, including an explicit cut. */
export function SlideTransitionMark({
  transition,
}: {
  readonly transition: SlideTransition | undefined;
}): JSX.Element | null {
  return transition === undefined ? null : (
    <span
      className={styles.mark}
      role="img"
      aria-label="개별 전환 설정"
      title="개별 전환 설정"
    />
  );
}
