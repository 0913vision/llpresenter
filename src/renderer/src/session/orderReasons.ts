import {SERVICE_LIMITS} from '@core/schema/service';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {ORDER_FULL_REASON} from './serviceOrderEdits';
import {useShow} from './show';

/** What an add to the 예배 순서 says when no service is open. */
export const NO_SERVICE_REASON = '열린 예배 없음';

/** What a command that changes the 예배 순서 says where it may not. */
export const ORDER_LOCKED_REASON = '예배 순서 편집 불가';

/**
 * Why a command can't change the 예배 순서: where it may change, the command's
 * own reason, if any; elsewhere, that the 예배 순서 can't be edited.
 */
export function orderEditReason(
  editable: boolean,
  own?: string,
): string | undefined {
  return editable ? own : ORDER_LOCKED_REASON;
}

/** Whether the open 예배 순서 has reached its item limit. */
export function useOrderFull(): boolean {
  return useShow(view => view.rows.length >= SERVICE_LIMITS.items);
}

/**
 * Why nothing can be added to the open 예배 순서 now, or undefined when an
 * add can go in. Every way of adding an item asks this one question.
 */
export function useOrderAddReason(): string | undefined {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
  if (serviceId === null) return NO_SERVICE_REASON;
  if (readOnly) return NEWER_FILE_REASON;
  return full ? ORDER_FULL_REASON : undefined;
}
