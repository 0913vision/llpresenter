import type {JSX} from 'react';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import styles from './SlideTransitionMark.module.css';

/** A corner mark for a slide with a visible transition effect. */
export function SlideTransitionMark({
  transition,
}: {
  readonly transition: SlideTransition | undefined;
}): JSX.Element | null {
  return transition === undefined || transition.kind === 'none' ? null : (
    <span
      className={styles.mark}
      role="img"
      aria-label="개별 전환 설정"
      title="개별 전환 설정"
    />
  );
}
