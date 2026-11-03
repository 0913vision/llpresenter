import {SERVICE_LIMITS} from '@core/schema/service';
import {useShow} from './show';

/** Whether the open 예배 순서 has reached its item limit. */
export function useOrderFull(): boolean {
  return useShow(view => view.rows.length >= SERVICE_LIMITS.items);
}
