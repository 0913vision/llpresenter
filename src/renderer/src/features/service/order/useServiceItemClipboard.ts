import {useLayoutEffect, useRef, useSyncExternalStore} from 'react';
import {createServiceId, createServiceItemId} from '@core/schema/ids';
import {SERVICE_LIMITS} from '@core/schema/service';
import {useShow} from '@renderer/session/show';
import {serviceItemClipboardFor} from '@renderer/session/serviceItemClipboard';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {useServiceOrderEditing} from './useServiceOrderEditing';

const EMPTY_CLIPBOARD = '복사한 예배 순서 항목이 없습니다';
const NO_ITEMS = '선택한 항목이 없습니다';
const noop = (): void => undefined;
const emptyCount = (): number => 0;

/** Connects the item clipboard to the same save/history path as other row edits. */
export function useServiceItemClipboard({
  serviceId,
  selected,
  editable,
  itemCount,
  editing,
  onProblem,
  onPasted,
}: {
  readonly serviceId: string | null;
  readonly selected: ReadonlySet<string>;
  readonly editable: boolean;
  readonly itemCount: number;
  readonly editing: ReturnType<typeof useServiceOrderEditing>;
  readonly onProblem: (notice: Notice) => void;
  readonly onPasted: (ids: readonly string[]) => void;
}) {
  const api = window.llp;
  const clipboard =
    api === undefined ? undefined : serviceItemClipboardFor(api);
  const count = useSyncExternalStore(
    clipboard?.subscribe ?? (() => noop),
    clipboard?.getCount ?? emptyCount,
  );
  const copyReason =
    api === undefined || serviceId === null || selected.size === 0
      ? NO_ITEMS
      : undefined;
  const pasteReason =
    serviceId === null
      ? '열린 예배가 없습니다'
      : !editable
        ? '예배 순서 편집 불가'
        : count === 0
          ? EMPTY_CLIPBOARD
          : itemCount + count > SERVICE_LIMITS.items
            ? ORDER_FULL_REASON
            : undefined;
  const pending = useRef<{
    serviceId: string;
    cursor: string | null;
    ids: readonly string[];
  } | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
    };
  }, []);
  const selectPasted = (): void => {
    const paste = pending.current;
    if (paste === null) return;
    const now = useShow.getState();
    if (
      !mounted.current ||
      now.serviceId !== paste.serviceId ||
      now.openItemId !== paste.cursor
    ) {
      pending.current = null;
      return;
    }
    if (paste.ids.every(id => now.rows.some(row => row.id === id))) {
      pending.current = null;
      onPasted(paste.ids);
    }
  };
  useLayoutEffect(selectPasted);
  const copy = async (ids: ReadonlySet<string> = selected): Promise<void> => {
    if (clipboard === undefined || serviceId === null || ids.size === 0) return;
    const result = await clipboard.copy(createServiceId(serviceId), ids);
    if (!result.ok) {
      onProblem({
        key: 'service-order:copy',
        kind: 'warning',
        icon: 'warning',
        title:
          result.error === 'full'
            ? '복사할 항목이 너무 큽니다'
            : '항목 복사 실패',
        time: noticeTime(),
      });
    }
  };
  const paste = async (afterId: string | null): Promise<void> => {
    if (clipboard === undefined || serviceId === null || !editable) {
      return;
    }
    const cursor = useShow.getState().openItemId;
    await clipboard.ready();
    const current = useShow.getState();
    if (current.serviceId !== serviceId || current.readOnly) return;
    const items = clipboard.createItems();
    if (items.length === 0) return;
    const saved = await editing.save((edits, id) =>
      edits.insertItems(
        id,
        items,
        afterId === null ? null : createServiceItemId(afterId),
      ),
    );
    if (saved) {
      pending.current = {serviceId, cursor, ids: items.map(item => item.id)};
      selectPasted();
    }
  };
  return {count, copy, paste, copyReason, pasteReason};
}
