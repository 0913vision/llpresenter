import type {JSX} from 'react';
import {useOutputs} from '@renderer/state/live';
import {defaultScreens} from './screens';
import styles from './StatusBar.module.css';

// TODO(0913vision): Show the save state and each output window's frame rate.

/** The 28px status bar: a dot for each screen on output, a dimmed name otherwise. */
export function StatusBar(): JSX.Element {
  const outputs = useOutputs();
  return (
    <footer className={styles.bar}>
      <span className={styles.spacer} />
      {defaultScreens.map(screen => {
        const on = outputs[screen.id] === true;
        return (
          <span
            key={screen.id}
            className={on ? styles.item : `${styles.item} ${styles.off}`}
          >
            {on ? <span className={styles.dot} /> : null}
            {screen.statusLabel}
          </span>
        );
      })}
    </footer>
  );
}
