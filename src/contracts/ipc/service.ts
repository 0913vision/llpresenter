import {
  parseServiceOpenReply,
  parseServiceOpenRequest,
  type ServiceOpenRequest,
} from '@core/schema/serviceOpen';
import {parseShowService, type ShowService} from '@core/schema/showService';
import {Channels} from './channels';
import {push, query, request, type IpcPort} from './endpoint';

/** The calls about the open 예배 순서 as 진행 shows it. */
export const serviceEndpoints = {
  get: query<ShowService | null>(Channels.serviceGet, parseShowService),
  open: request<ServiceOpenRequest, ShowService | null>(Channels.serviceOpen, {
    request: parseServiceOpenRequest,
    reply: (value, sent) => parseServiceOpenReply(sent.serviceId, value),
  }),
  changed: push<ShowService | null>(Channels.serviceChanged, parseShowService),
};

/** The open 예배 순서 part of `window.llp`. */
export function serviceApi(port: IpcPort) {
  return {
    /**
     * Reads the open 예배 순서 as 진행 shows it, or `null` when none is open.
     * It waits while the main process reads the data at launch. Rejects, after
     * logging, when the call fails or the answer is malformed, so a failed
     * read is never taken for "no 예배 순서".
     */
    get: port.query(serviceEndpoints.get),
    /** Saves the current service and opens another without changing live output; null means it stayed open. */
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
