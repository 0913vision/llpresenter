import {useMemo, useState, type ComponentProps, type JSX} from 'react';
import {isStartItem} from '@core/services/itemFieldChanges';
import {backgroundRequest, memoRequest} from '../items/itemPlaybackCommands';
import {ItemMemoDialog} from './ItemMemoDialog';
import {menuAvailability} from '@renderer/ui/menuModel';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
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
  const [memo, setMemo] = useState<{
    serviceId: string;
    itemId: string;
    title: string;
    value: string;
  } | null>(null);
  const onProblem: (notice: Notice) => void = list.onProblem ?? noProblem;
  const table = useMemo<ServiceTableParts>(
    () => ({
      setBackground: (serviceId, itemId, mediaId) =>
        items.submitItemEdit(backgroundRequest({serviceId, itemId}, mediaId)),
      menuFor: row => {
        const item = data.items.get(row.id);
        if (item === undefined || !isStartItem(item) || serviceId === null) {
          return [];
        }
        return [
          {
            kind: 'item',
            id: 'memo',
            contextGroup: 'memo',
            label: '메모…',
            ...menuAvailability(readOnly ? NEWER_FILE_REASON : undefined),
            onSelect: () =>
              setMemo({
                serviceId,
                itemId: item.id,
                title: row.title,
                value: item.memo ?? '',
              }),
          },
        ];
      },
      header: <ServiceTableHeader />,
      rowClass: styles.row,
      sectionClass: styles.section,
      cellsOf: (row, detail, rowLabel) => (
        <ServiceTableCells
          row={row}
          rowLabel={rowLabel}
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
      {memo === null ? null : (
        <ItemMemoDialog
          memo={memo.value}
          title={memo.title}
          save={value =>
            items.submitItemEdit(
              memoRequest(
                {serviceId: memo.serviceId, itemId: memo.itemId},
                value,
              ),
            )
          }
          onClose={() => setMemo(null)}
        />
      )}
    </div>
  );
}
