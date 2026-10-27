import type {JSX} from 'react';
import {useOutputs} from '@renderer/state/live';
import {useScreenSummaries} from './ScreenSummaries';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import styles from './StatusBar.module.css';

// TODO(0913vision): Show the save state and each output window's frame rate.

/** The 28px status bar: a dot for each screen on output, a dimmed name otherwise. */
export function StatusBar(): JSX.Element {
  const outputs = useOutputs();
  const screens = useScreenSummaries();
  return (
    <footer role="status" className={styles.bar}>
      <span className={styles.spacer} />
      <div
        className={styles.screens}
        role="group"
        aria-label="화면 출력 상태"
        tabIndex={-1}
      >
        {screens.map(screen => {
          const on = outputs[screen.id] === true;
          return (
            <span
              key={screen.id}
              className={on ? styles.item : `${styles.item} ${styles.off}`}
            >
              {on ? <span className={styles.dot} aria-hidden="true" /> : null}
              <TruncatedText
                text={screen.statusLabel}
                className={styles.name}
              />
            </span>
          );
        })}
      </div>
    </footer>
  );
}
