import {
  parseOrderEditorTarget,
  type OrderEditorTarget,
} from '@core/schema/ipcPayloads';
import {push, query, type IpcPort} from './endpoint';

/** What the 순서 편집 window shows, and the pushes that move it to another target. */
export const orderEditorEndpoints = {
  target: query<OrderEditorTarget | null>('order-editor:target', value =>
    value === null ? {ok: true, value: null} : parseOrderEditorTarget(value),
  ),
  retarget: push<OrderEditorTarget | null>('order-editor:retarget', value =>
    value === null ? {ok: true, value: null} : parseOrderEditorTarget(value),
  ),
};

/** The 순서 편집 window part of `window.llp`. */
export function orderEditorApi(port: IpcPort) {
  return {
    /** The target this window was opened on, or null when it has none. */
    target: port.query(orderEditorEndpoints.target),
    /** Follows the target changes of a window that stays open. */
    onRetarget: port.subscribe(orderEditorEndpoints.retarget),
  };
}

export type OrderEditorApi = ReturnType<typeof orderEditorApi>;
