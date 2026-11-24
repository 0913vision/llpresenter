import {parseUpdateAction, parseUpdateSnapshot} from '@core/schema/app/update';
import {message, push, query, signal, type IpcPort} from './endpoint';

/** Update commands are accepted only from the control window's main frame. */
export const updateEndpoints = {
  get: query('update:get', parseUpdateSnapshot),
  check: signal('update:check'),
  act: message('update:act', parseUpdateAction),
  changed: push('update:changed', parseUpdateSnapshot),
};

/** The update part of `window.llp`. */
export function updateApi(port: IpcPort) {
  return {
    get: port.query(updateEndpoints.get),
    check: port.signal(updateEndpoints.check),
    act: port.message(updateEndpoints.act),
    subscribe: port.subscribe(updateEndpoints.changed),
  };
}

/** The update part of `window.llp` as the renderer sees it. */
export type UpdateApi = ReturnType<typeof updateApi>;
