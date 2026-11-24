import {useEffect, useState} from 'react';
import type {MenuEntry} from './menuModel';
import {MenuSurface} from './MenuSurface';
import styles from './Menu.module.css';

/** Prepares menu layout during idle time without showing or focusing it. */
export function MenuWarmup({
  entries,
}: {
  readonly entries: readonly MenuEntry[];
}) {
  const [warming, setWarming] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback !== 'function') return undefined;
    const idle = requestIdleCallback(() => setWarming(true));
    return () => cancelIdleCallback(idle);
  }, []);
  useEffect(() => {
    if (!warming) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setWarming(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [warming]);
  return warming ? (
    <div className={styles.warmup} inert aria-hidden="true">
      <MenuSurface
        label=""
        entries={entries}
        place={() => ({x: 0, y: 0})}
        onClose={() => undefined}
        autoFocus={false}
      />
    </div>
  ) : null;
}
