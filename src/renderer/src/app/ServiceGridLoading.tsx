import {useState, useSyncExternalStore, type JSX} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {isItemRow} from '@core/presentation/model';
import {useShow} from '@renderer/session/show';
import {
  hasRetainedGrid,
  retainedGridsVersion,
  subscribeRetainedGrids,
} from '@renderer/session/shownItem';
import styles from './ServiceGridLoading.module.css';

/** Waits for a newly opened service, without interrupting later item edits. */
export function ServiceGridLoading(): JSX.Element | null {
  const {serviceId, serviceEpoch, rows} = useShow(
    useShallow(view => ({
      serviceId: view.serviceId,
      serviceEpoch: view.serviceEpoch,
      rows: view.rows,
    })),
  );
  useSyncExternalStore(subscribeRetainedGrids, retainedGridsVersion);
  const [completed, setCompleted] = useState<number | null>(null);
  const items = rows.filter(isItemRow);
  const ready =
    serviceId === null
      ? 0
      : items.filter(row => hasRetainedGrid(serviceId, row.id)).length;
  if (
    serviceId !== null &&
    ready === items.length &&
    completed !== serviceEpoch
  ) {
    setCompleted(serviceEpoch);
  }
  if (
    serviceId === null ||
    completed === serviceEpoch ||
    ready === items.length
  ) {
    return null;
  }
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span>예배 준비 중</span>
      <progress
        aria-label="예배 준비 진행률"
        max={items.length}
        value={ready}
      />
    </div>
  );
}
