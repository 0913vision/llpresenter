import {parsePreparation, type Preparation} from '@core/schema/launch';
import {
  parseServiceOpenReply,
  parseServiceOpenRequest,
  type ServiceOpenRequest,
} from '@core/schema/serviceOpen';
import {parseShowService, type ShowService} from '@core/schema/showService';
import {message, push, query, request, signal, type IpcPort} from './endpoint';

/** The calls about the open 예배 순서 as 진행 shows it. */
export const serviceEndpoints = {
  preparing: message<Preparation>('service:preparing', parsePreparation),
  ready: signal('service:ready'),
  get: query<ShowService | null>('service:get', parseShowService),
  open: request<ServiceOpenRequest, ShowService | null>('service:open', {
    request: parseServiceOpenRequest,
    reply: (value, sent) => parseServiceOpenReply(sent.serviceId, value),
    refuse: () => null,
  }),
  changed: push<ShowService | null>('service:changed', parseShowService),
};

/** The open 예배 순서 part of `window.llp`. */
export function serviceApi(port: IpcPort) {
  return {
    /** Tells how much of the control window is prepared, during the launch. */
    preparing: port.message(serviceEndpoints.preparing),
    /** The control window is prepared, so it can show. */
    ready: port.signal(serviceEndpoints.ready),
    /**
     * Reads the open 예배 순서 as 진행 shows it, or `null` when none is open.
     * It waits while the main process reads the data at launch. Rejects, after
     * logging, when the call fails or the answer is malformed, so a failed
     * read is never taken for "no 예배 순서".
     */
    get: port.query(serviceEndpoints.get),
    /** Saves the current service and opens another; a changed service returns output to standby. */
    open: port.request(serviceEndpoints.open),
    /**
     * Calls the listener when the open 예배 순서 changes, or another one opens.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(serviceEndpoints.changed),
  };
}

export type ServiceApi = ReturnType<typeof serviceApi>;
