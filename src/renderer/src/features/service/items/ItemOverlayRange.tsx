import {useState, type JSX} from 'react';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import {overlayRangesOverlap} from '@core/themes/overlayRanges';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './ItemOverlays.module.css';
export function ItemOverlayRange({
  overlay,
  rows,
  items,
  count,
  reason,
}: {
  readonly overlay: ItemOverlay;
  readonly rows: readonly ItemOverlay[];
  readonly items: ServiceItemStore;
  readonly count: number;
  readonly reason: string | undefined;
}): JSX.Element {
  const [rangeReason, setRangeReason] = useState<string>();
  const [rangeDraft, setRangeDraft] = useState<{
    readonly from: number;
    readonly to: number;
  } | null>(null);
  const range = (patch: {
    readonly from?: number;
    readonly to?: number;
  }): void => {
    const next = {...overlay, ...rangeDraft, ...patch};
    setRangeDraft({from: next.from, to: next.to});
    const failure =
      next.from > next.to
        ? '끝 슬라이드는 시작 슬라이드보다 앞설 수 없습니다'
        : overlayRangesOverlap(
              rows.map(row => (row.id === overlay.id ? next : row)),
            )
          ? '다른 오버레이와 슬라이드 범위가 겹칩니다'
          : undefined;
    setRangeReason(failure);
    if (failure === undefined) {
      editorTask(
        items
          .changeOverlays(current =>
            current.map(row =>
              row.id === overlay.id
                ? {...row, from: next.from, to: next.to}
                : row,
            ),
          )
          .then(saved => {
            if (saved) {
              setRangeDraft(current =>
                current?.from === next.from && current.to === next.to
                  ? null
                  : current,
              );
            }
          }),
      );
    }
  };
  return (
    <PropertyRow label="슬라이드">
      {() => (
        <div className={`${styles.controls} ${styles.range}`}>
          <NumberField
            aria-label="시작 슬라이드"
            value={rangeDraft?.from ?? overlay.from}
            min={1}
            max={Math.max(1, count)}
            updateOn="commit"
            readOnly={reason !== undefined}
            invalid={rangeReason !== undefined}
            invalidReason={rangeReason}
            title={reason}
            onChange={from => range({from})}
          />
          <span>부터</span>
          <NumberField
            aria-label="끝 슬라이드"
            value={rangeDraft?.to ?? overlay.to}
            min={1}
            max={Math.max(1, count)}
            updateOn="commit"
            readOnly={reason !== undefined}
            invalid={rangeReason !== undefined}
            invalidReason={rangeReason}
            title={reason}
            onChange={to => range({to})}
          />
          <span>까지</span>
        </div>
      )}
    </PropertyRow>
  );
}
