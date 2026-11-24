import type {JSX} from 'react';
import type {DisplayLayoutModel} from './layoutBoxes';
import styles from './MonitorThumbnail.module.css';

const VIEWBOX_WIDTH = 100;

export function MonitorThumbnail({
  layout,
  number,
}: {
  readonly layout: DisplayLayoutModel;
  readonly number: number;
}): JSX.Element {
  const height = VIEWBOX_WIDTH / layout.aspectRatio;
  return (
    <svg
      aria-hidden="true"
      className={styles.thumbnail}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
    >
      {layout.monitors.map(box => (
        <rect
          key={box.number}
          data-monitor={box.number}
          data-selected={box.number === number}
          className={styles.monitor}
          x={box.left}
          y={(box.top / VIEWBOX_WIDTH) * height}
          width={box.width}
          height={(box.height / VIEWBOX_WIDTH) * height}
        />
      ))}
    </svg>
  );
}
