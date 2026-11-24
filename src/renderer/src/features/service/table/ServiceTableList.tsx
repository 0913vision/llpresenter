import {useMemo, type ComponentProps, type JSX} from 'react';
import type {ServiceItem} from '@core/schema/services/service';
import {useOpenService} from '@renderer/session/service/openService';
import type {Notice} from '@renderer/ui/popups/notices';
import {ServiceOrderList} from '../order/ServiceOrderList';
import type {ServiceTableParts} from '../order/serviceTableParts';
import {ServiceTableCells} from './ServiceTableCells';
import {ServiceTableFooter} from './ServiceTableFooter';
import {ServiceTableHeader} from './ServiceTableHeader';
import styles from './ServiceTable.module.css';
import {useShow} from '@renderer/session/show/showStore';

function noProblem(): void {
  return undefined;
}

/** The 예배 순서 of 준비 as a table: one row per item with its 슬라이드 count. */
export function ServiceTableList(
  list: Omit<ComponentProps<typeof ServiceOrderList>, 'table' | 'workspace'>,
): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const order = useOpenService(view => view.service?.order);
  const onProblem: (notice: Notice) => void = list.onProblem ?? noProblem;
  const table = useMemo<ServiceTableParts>(() => {
    const items = new Map<string, ServiceItem>(
      (order ?? []).map(item => [item.id, item]),
    );
    return {
      header: <ServiceTableHeader />,
      rowClass: styles.row,
      sectionClass: styles.section,
      cellsOf: row => <ServiceTableCells row={row} item={items.get(row.id)} />,
      footer:
        serviceId === null ? null : (
          <ServiceTableFooter onProblem={onProblem} />
        ),
    };
  }, [order, serviceId, onProblem]);
  return (
    <div className={styles.table}>
      <ServiceOrderList {...list} workspace="prep" table={table} />
    </div>
  );
}
