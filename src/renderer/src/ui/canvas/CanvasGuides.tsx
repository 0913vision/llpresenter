import type {JSX} from 'react';
import type {GuideLines} from '@core/canvas';
import styles from './CanvasEditor.module.css';

/** The lines a dragged frame snaps to, inside the document only. */
export function CanvasGuides({
  guides,
  width,
  height,
}: {
  readonly guides: GuideLines;
  readonly width: number;
  readonly height: number;
}): JSX.Element {
  const inside = (value: number | undefined, size: number): value is number =>
    value !== undefined && value >= 0 && value <= size;
  return (
    <div className={styles.guides} aria-hidden="true">
      {inside(guides.x, width) ? (
        <span
          className={styles.guideX}
          data-canvas-guide="x"
          style={{
            left: `min(${(100 * guides.x) / width}%, calc(100% - var(--size-guide-line)))`,
          }}
        />
      ) : null}
      {inside(guides.y, height) ? (
        <span
          className={styles.guideY}
          data-canvas-guide="y"
          style={{
            top: `min(${(100 * guides.y) / height}%, calc(100% - var(--size-guide-line)))`,
          }}
        />
      ) : null}
    </div>
  );
}
