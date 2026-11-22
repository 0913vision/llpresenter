import {useMemo, useState, type ComponentProps, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {hasSlides, type ServiceItem} from '@core/schema/service';
import {withMemo} from '@core/services/itemFields';
import {menuAvailability} from '@renderer/ui/menuModel';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {editItem, useOpenService} from '@renderer/session/openService';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import {useMacros} from '../details/ItemSettingsRows';
import {ServiceOrderList} from '../order/ServiceOrderList';
import type {ServiceTableParts} from '../order/serviceTableParts';
import {handleCellKey} from './cellKeys';
import {ItemMemoDialog} from './ItemMemoDialog';
import {ServiceTableCells} from './ServiceTableCells';
import {ServiceTableFooter} from './ServiceTableFooter';
import {ServiceTableHeader} from './ServiceTableHeader';
import styles from './ServiceTable.module.css';

const noProblem = (): void => undefined;

/** The 예배 순서 of 준비 as a table: one row per item, edited in place. */
export function ServiceTableList({
  api,
  ...list
}: Omit<ComponentProps<typeof ServiceOrderList>, 'table' | 'workspace'> & {
  readonly api: Pick<LlpApi, 'settings'>;
}): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const order = useOpenService(view => view.service?.order);
  const readOnly = useOpenService(view => view.readOnly);
  const macros = useMacros(api.settings).document?.value.macros;
  const [memo, setMemo] = useState<{
    readonly itemId: string;
    readonly title: string;
    readonly value: string;
  } | null>(null);
  const onProblem: (notice: Notice) => void = list.onProblem ?? noProblem;
  const table = useMemo<ServiceTableParts>(() => {
    const items = new Map<string, ServiceItem>(
      (order ?? []).map(item => [item.id, item]),
    );
    return {
      menuFor: row => {
        const item = items.get(row.id);
        if (item === undefined || !hasSlides(item)) return [];
        return [
          {
            kind: 'item',
            id: 'memo',
            contextGroup: 'memo',
            label: '메모…',
            ...menuAvailability(readOnly ? NEWER_FILE_REASON : undefined),
            onSelect: () =>
              setMemo({
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
      cellsOf: (row, rowLabel) => (
        <ServiceTableCells
          row={row}
          rowLabel={rowLabel}
          item={items.get(row.id)}
          macros={macros ?? []}
          readOnly={readOnly}
          report={onProblem}
        />
      ),
      footer:
        serviceId === null ? null : (
          <ServiceTableFooter onProblem={onProblem} />
        ),
    };
  }, [order, macros, serviceId, readOnly, onProblem]);
  return (
    <div className={styles.table} onKeyDownCapture={handleCellKey}>
      <ServiceOrderList {...list} workspace="prep" table={table} />
      {memo === null ? null : (
        <ItemMemoDialog
          memo={memo.value}
          title={memo.title}
          save={async value => {
            const result = await editItem(memo.itemId, item =>
              withMemo(item, value),
            );
            return result.ok || result.error.reason === 'write-failed';
          }}
          onClose={() => setMemo(null)}
        />
      )}
    </div>
  );
}
