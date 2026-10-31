import type {JSX} from 'react';
import {IconButton} from './IconButton';
import {GeometryField} from './GeometryField';
import {
  MIN_SIZE,
  type ElementFrame,
  type FrameField,
} from '@core/canvas/frameEdit';
import styles from './CanvasFrameBar.module.css';

const FIELDS = ['x', 'y', 'w', 'h'] as const;

/** Edits reference-picture pixels without applying canvas zoom to saved values. */
export function CanvasFrameBar({
  frame,
  width,
  height,
  zoom,
  readOnlyReason,
  keepRatio,
  setKeepRatio,
  snapGrid,
  setSnapGrid,
  change,
  showFields = true,
  zoomControl,
  minimumSize = MIN_SIZE,
}: {
  frame: ElementFrame | undefined;
  width: number;
  height: number;
  zoom: number;
  readOnlyReason: string | undefined;
  keepRatio: boolean;
  setKeepRatio: (value: boolean) => void;
  snapGrid: boolean;
  setSnapGrid: (value: boolean) => void;
  change: (field: FrameField, value: number) => void;
  showFields?: boolean;
  minimumSize?: number;
  zoomControl?:
    | {readonly value: number; readonly change: (value: number) => void}
    | undefined;
}): JSX.Element {
  const readOnly = readOnlyReason !== undefined;
  const reason =
    readOnlyReason ?? (frame === undefined ? '선택한 요소 없음' : undefined);
  return (
    <footer
      className={styles.bar}
      aria-label={showFields ? '요소 위치와 크기' : '캔버스 설정'}
    >
      {(showFields ? FIELDS : []).map(field => {
        const limit = field === 'x' || field === 'w' ? width : height;
        return (
          <label key={field} className={styles.field}>
            <span>{field.toUpperCase()}</span>
            <GeometryField
              aria-label={field.toUpperCase()}
              value={frame?.[field] ?? 0}
              min={
                field === 'x' || field === 'y'
                  ? 0
                  : Math.min(minimumSize, limit)
              }
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
        title={readOnlyReason}
        onPressedChange={setKeepRatio}
      />
      <IconButton
        icon="grid"
        className={showFields ? undefined : styles.first}
        label="격자에 맞추기"
        pressed={snapGrid}
        disabled={readOnly}
        title={readOnlyReason}
        onPressedChange={setSnapGrid}
      />
      <div className={styles.zoom}>
        {zoomControl === undefined ? null : (
          <IconButton
            icon="min"
            label="축소"
            disabled={zoomControl.value <= 0.25}
            onClick={() =>
              zoomControl.change(Math.max(0.25, zoomControl.value - 0.25))
            }
          />
        )}
        <output aria-label="캔버스 배율">{Math.round(100 * zoom)}%</output>
        {zoomControl === undefined ? null : (
          <>
            <IconButton
              icon="plus"
              label="확대"
              disabled={zoomControl.value >= 4}
              onClick={() =>
                zoomControl.change(Math.min(4, zoomControl.value + 0.25))
              }
            />
            <IconButton
              icon="frame"
              label="화면에 맞춤"
              onClick={() => zoomControl.change(1)}
            />
          </>
        )}
      </div>
    </footer>
  );
}
