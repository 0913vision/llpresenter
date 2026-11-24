import {useState, type JSX} from 'react';
import type {LiturgyTranslation} from '@core/slides';
import {createServiceItemId, type ServiceItemId} from '@core/schema/common/ids';
import type {ServiceItem} from '@core/schema/services/service';
import type {Report} from '@renderer/session/service/serviceEdit';
import {useOrderFull} from '@renderer/session/service/orderReasons';
import {warningNotice} from '@renderer/ui/popups/notices';
import {BibleQuickAdd} from './BibleQuickAdd';
import {
  insertNewItem,
  rowAfterSelected,
} from '@renderer/session/service/insertIntoOrder';
import {newPaletteItem} from './newItems';
import {newBibleItem, newSermonItem} from './passageItems';
import {SermonQuickAdd} from './SermonQuickAdd';
import {useShow} from '@renderer/session/show/showStore';

/** Where an element goes and how it is made. */
export interface InsertOptions {
  /** The row it goes before; null for the end, none for after the selection. */
  readonly before?: string | null | undefined;
  readonly translation?: LiturgyTranslation | undefined;
  /** Opens the new item in the editor to be filled in. */
  readonly edit?: boolean | undefined;
}

interface Asking {
  readonly kind: 'bible' | 'sermon';
  readonly before: ServiceItemId | null;
  readonly serviceId: string;
}

/** Puts what the palette offers in the 예배 순서, asking for a passage first. */
export function usePaletteInsert(report: Report): {
  readonly insert: (key: string, options?: InsertOptions) => void;
  readonly disabled: boolean;
  readonly dialog: JSX.Element | null;
} {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
  const [asking, setAsking] = useState<Asking | null>(null);
  const disabled = serviceId === null || readOnly || full;
  const insert = (
    key: string,
    {before, translation, edit = false}: InsertOptions = {},
  ): void => {
    if (serviceId === null || disabled) return;
    const target =
      before === undefined
        ? rowAfterSelected()
        : before === null
          ? null
          : createServiceItemId(before);
    if (key === 'bible' || key === 'sermon') {
      setAsking({kind: key, before: target, serviceId});
      return;
    }
    const item = newPaletteItem(key, translation);
    if (item !== null) insertNewItem(item, target, {report, edit});
  };
  const add = (made: Promise<ServiceItem | null>): void => {
    const before = asking?.before ?? null;
    setAsking(null);
    made.then(
      item => {
        if (item !== null && useShow.getState().serviceId === serviceId) {
          insertNewItem(item, before, {report});
        }
      },
      (error: unknown) => {
        console.error('Could not make a passage item', error);
        report(warningNotice('service-order:passage', '성경 구절 추가 실패'));
      },
    );
  };
  const close = (): void => setAsking(null);
  const dialog =
    asking?.serviceId !== serviceId || readOnly ? null : asking.kind ===
      'sermon' ? (
      <SermonQuickAdd
        onClose={close}
        onInsert={(title, passage, defaults) =>
          add(newSermonItem(title, passage, defaults))
        }
      />
    ) : (
      <BibleQuickAdd
        onClose={close}
        onInsert={(passage, defaults) => add(newBibleItem(passage, defaults))}
      />
    );
  return {insert, disabled, dialog};
}
