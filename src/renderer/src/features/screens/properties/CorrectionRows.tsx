import type {Screen} from '@core/schema/screens/screens';
import type {JSX} from 'react';
import {EDGE_MARGIN_MAX, OFFSET_LIMIT} from '@core/screens';
import {NumberField} from '@renderer/ui/fields/NumberField';
import {PropertyGroup, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import styles from './ScreenProperties.module.css';
import {CANVAS_SIZE, type OnScreenChange} from './screenPropertyParts';

/** The 보정 group of a 화면: 가장자리 여백 and 위치 미세 조정 in canvas pixels. */
export function CorrectionRows({
  screen,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly change: OnScreenChange;
  readonly reason: string | undefined;
}): JSX.Element {
  const offset = screen.offset ?? {x: 0, y: 0};
  return (
    <PropertyGroup title="보정">
      <PropertyRow label="가장자리 여백">
        {({controlId}) => (
          <NumberField
            id={controlId}
            readOnly={reason !== undefined}
            aria-disabled={reason !== undefined ? true : undefined}
            title={reason}
            value={screen.edgeMargin ?? 0}
            min={0}
            max={EDGE_MARGIN_MAX}
            suffix="%"
            updateOn="commit"
            onChange={edgeMargin => change({edgeMargin})}
          />
        )}
      </PropertyRow>
      <PropertyRow label="위치 미세 조정">
        {({controlId}) => (
          <span className={styles.pair}>
            <NumberField
              id={controlId}
              readOnly={reason !== undefined}
              aria-disabled={reason !== undefined ? true : undefined}
              title={reason ?? `${CANVAS_SIZE} 화면 기준 px`}
              aria-label="가로 위치"
              value={offset.x}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={x => change({offset: {x}})}
            />
            <NumberField
              aria-label="세로 위치"
              readOnly={reason !== undefined}
              aria-disabled={reason !== undefined ? true : undefined}
              title={reason ?? `${CANVAS_SIZE} 화면 기준 px`}
              value={offset.y}
              min={-OFFSET_LIMIT}
              max={OFFSET_LIMIT}
              unit="px"
              updateOn="commit"
              onChange={y => change({offset: {y}})}
            />
          </span>
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}
