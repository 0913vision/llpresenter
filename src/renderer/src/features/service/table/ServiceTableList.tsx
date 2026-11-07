import {useMemo, type ComponentProps, type JSX} from 'react';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {ServiceOrderList} from '../order/ServiceOrderList';
import type {ServiceTableParts} from '../order/serviceTableParts';
import {handleCellKey} from './cellKeys';
import {ServiceTableCells} from './ServiceTableCells';
import {ServiceTableFooter} from './ServiceTableFooter';
import {ServiceTableHeader} from './ServiceTableHeader';
import {useServiceTableData, type TableApi} from './useServiceTableData';
import styles from './ServiceTable.module.css';

const noProblem = (): void => undefined;

/** The 예배 순서 of 준비 as a table: one row per item, edited in place. */
export function ServiceTableList({
  api,
  items,
  ...list
}: Omit<ComponentProps<typeof ServiceOrderList>, 'table' | 'workspace'> & {
  readonly api: TableApi;
  readonly items: Pick<ServiceItemStore, 'submitItemEdit'>;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const data = useServiceTableData(api, serviceId);
  const onProblem: (notice: Notice) => void = list.onProblem ?? noProblem;
  const table = useMemo<ServiceTableParts>(
    () => ({
      header: <ServiceTableHeader />,
      rowClass: styles.row,
      sectionClass: styles.section,
      cellsOf: (row, detail) => (
        <ServiceTableCells
          row={row}
          item={data.items.get(row.id)}
          detail={detail}
          themes={data.themeFile}
          macros={data.macroList}
          media={data.media}
          songs={data.songs}
          items={items}
          serviceId={serviceId}
          readOnly={readOnly}
        />
      ),
      footer:
        serviceId === null ? null : (
          <ServiceTableFooter onProblem={onProblem} />
        ),
    }),
    [data, items, serviceId, readOnly, onProblem],
  );
  return (
    <div className={styles.table} onKeyDownCapture={handleCellKey}>
      <ServiceOrderList {...list} workspace="prep" table={table} />
    </div>
  );
}
