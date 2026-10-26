import type {JSX} from 'react';
import styles from './TestPattern.module.css';

const BAR_CLASSES = [
  styles.white,
  styles.yellow,
  styles.cyan,
  styles.green,
  styles.magenta,
  styles.red,
  styles.blue,
] as const;

const RAMP_STEPS = 11;
const PERCENT = 100;

const rampLevels = Array.from(
  {length: RAMP_STEPS},
  (_, step) => (step / (RAMP_STEPS - 1)) * PERCENT,
);

/**
 * The test pattern of spec 06: seven color bars over a gray ramp in 11 steps,
 * a white border, and the screen name and resolution in the center. It fills
 * its parent.
 */
export function TestPattern({
  name,
  resolution,
}: {
  readonly name: string;
  /** Such as `1920×1080`; left out while unknown. */
  readonly resolution: string;
}): JSX.Element {
  return (
    <div className={styles.pattern} data-testid="test-pattern">
      <div className={styles.bars}>
        {BAR_CLASSES.map(bar => (
          <div key={bar} className={bar} />
        ))}
      </div>
      <div className={styles.ramp}>
        {rampLevels.map(level => (
          <div key={level} style={{background: `hsl(0 0% ${level}%)`}} />
        ))}
      </div>
      <div className={styles.label}>
        <span>{name}</span>
        {resolution !== '' && <span>{resolution}</span>}
      </div>
    </div>
  );
}
