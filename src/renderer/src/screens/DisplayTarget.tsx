import {memo, type JSX} from 'react';
import {classNames} from '@renderer/ui/classNames';
import type {TargetBox} from './layoutBoxes';
import {useScreensSelection} from './selection';
import styles from './DisplayLayout.module.css';

/** A target redraws only when its own screen or selected state changes. */
export const DisplayTarget = memo(
  ({id, name, detail, resolution, selected}: TargetBox): JSX.Element => {
    return (
      <button
        type="button"
        aria-label={name}
        aria-pressed={selected}
        onClick={() => useScreensSelection.getState().select('screen', id)}
        className={classNames(styles.target, selected && styles.selected)}
        data-target={id}
        aria-current={selected ? 'true' : undefined}
      >
        <span className={styles.targetName}>{name}</span>
        <span>{detail}</span>
        {resolution !== undefined && <span>{resolution}</span>}
      </button>
    );
  },
);
