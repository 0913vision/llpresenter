import {parseUpdateAction, parseUpdateSnapshot} from '@core/schema/update';
import {message, push, query, signal, type IpcPort} from './endpoint';

/** Update commands are accepted only from the control window's main frame. */
export const updateEndpoints = {
  get: query('update:get', parseUpdateSnapshot),
  check: signal('update:check'),
  act: message('update:act', parseUpdateAction),
  changed: push('update:changed', parseUpdateSnapshot),
};

export function updateApi(port: IpcPort) {
  return {
    get: port.query(updateEndpoints.get),
    check: port.signal(updateEndpoints.check),
    act: port.message(updateEndpoints.act),
    subscribe: port.subscribe(updateEndpoints.changed),
  };
}

export type UpdateApi = ReturnType<typeof updateApi>;
