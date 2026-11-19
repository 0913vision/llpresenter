import type {JSX} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import styles from './SlideTransitionControl.module.css';

export function EffectPicture({
  kind,
}: {
  readonly kind: SlideTransition['kind'];
}): JSX.Element {
  return (
    <svg viewBox="0 0 44 30" aria-hidden="true">
      <rect x="4" y="5" width="36" height="20" rx="2" className={styles.old} />
      {kind === 'none' ? <path d="M9 25 35 5" className={styles.edge} /> : null}
      {kind === 'dissolve' ? (
        <rect
          x="16"
          y="9"
          width="24"
          height="16"
          rx="2"
          opacity=".7"
          className={styles.next}
        />
      ) : null}
      {kind === 'push' ? (
        <>
          <rect x="16" y="5" width="24" height="20" className={styles.next} />
          <path
            d="M36 15H22m4-4-4 4 4 4M7 11h5M5 15h7M7 19h5"
            className={styles.edge}
          />
        </>
      ) : null}
      {kind === 'wipe' ? (
        <>
          <rect x="20" y="5" width="20" height="20" className={styles.next} />
          <path d="M20 4v22" className={styles.edge} />
        </>
      ) : null}
    </svg>
  );
}
