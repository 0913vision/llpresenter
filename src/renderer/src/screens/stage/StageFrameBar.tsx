import type {JSX} from 'react';
import {IconButton, NumberField} from '@renderer/ui';
import type {ElementFrame, FrameField} from './frameEdit';
import {STAGE_READ_ONLY} from './StageTextProperties';
import styles from './StageFrameBar.module.css';

const FIELDS = ['x', 'y', 'w', 'h'] as const;

/** Edits reference-picture pixels without applying canvas zoom to saved values. */
export function StageFrameBar({
  frame,
  width,
  height,
  zoom,
  readOnly,
  keepRatio,
  setKeepRatio,
  snapGrid,
  setSnapGrid,
  change,
}: {
  frame: ElementFrame | undefined;
  width: number;
  height: number;
  zoom: number;
  readOnly: boolean;
  keepRatio: boolean;
  setKeepRatio: (value: boolean) => void;
  snapGrid: boolean;
  setSnapGrid: (value: boolean) => void;
  change: (field: FrameField, value: number) => void;
}): JSX.Element {
  const reason = readOnly
    ? STAGE_READ_ONLY
    : frame === undefined
      ? '선택한 요소 없음'
      : undefined;
  return (
    <footer className={styles.bar} aria-label="요소 위치와 크기">
      {FIELDS.map(field => {
        const limit = field === 'x' || field === 'w' ? width : height;
        return (
          <label key={field} className={styles.field}>
            <span>{field.toUpperCase()}</span>
            <NumberField
              aria-label={field.toUpperCase()}
              value={frame?.[field] ?? 0}
              min={field === 'x' || field === 'y' ? 0 : Math.min(20, limit)}
              max={limit}
              unit="px"
              readOnly={reason !== undefined}
              title={reason}
              updateOn="commit"
              onChange={value => change(field, value)}
            />
          </label>
        );
      })}
      <IconButton
        icon="link"
        label="비율 고정"
        pressed={keepRatio}
        disabled={readOnly}
        title={readOnly ? STAGE_READ_ONLY : undefined}
        onPressedChange={setKeepRatio}
      />
      <IconButton
        icon="grid"
        label="격자에 맞추기"
        pressed={snapGrid}
        disabled={readOnly}
        title={readOnly ? STAGE_READ_ONLY : undefined}
        onPressedChange={setSnapGrid}
      />
      <output className={styles.zoom} aria-label="캔버스 배율">
        {Math.round(100 * zoom)}%
      </output>
    </footer>
  );
}
