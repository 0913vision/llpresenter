import {parseFontCatalog, type FontCatalog} from '@core/schema/fontCatalog';
import {
  parseFrameRateReport,
  parseFrameReadyReply,
  parseFrameReadyReport,
  parseRendererLogEntry,
  type FrameRateReport,
  type FrameReadyReport,
  type RendererLogEntry,
} from '@core/schema/ipcPayloads';
import {parseMonitorList, type MonitorList} from '@core/schema/monitors';
import {
  parseOutputRetryRequest,
  parseOutputShowWindowRequest,
  parseOutputStatuses,
  type OutputRetryRequest,
  type OutputShowWindowRequest,
  type OutputStatuses,
} from '@core/schema/outputStatus';
import {message, push, query, request, signal, type IpcPort} from './endpoint';

/** The calls about output windows, monitors, fonts, and the log. */
export const outputEndpoints = {
  frameRate: message<FrameRateReport>(
    'output:frame-rate',
    parseFrameRateReport,
  ),
  frameReady: request<FrameReadyReport, boolean>('output:frame-ready', {
    request: parseFrameReadyReport,
    reply: parseFrameReadyReply,
    refuse: () => false,
  }),
  status: query<OutputStatuses>('output:status:get', parseOutputStatuses),
  statusChanged: push<OutputStatuses>(
    'output:status:changed',
    parseOutputStatuses,
  ),
  retry: message<OutputRetryRequest>('output:retry', parseOutputRetryRequest),
  findMonitors: signal('output:find-monitors'),
  showWindow: message<OutputShowWindowRequest>(
    'output:show-window',
    parseOutputShowWindowRequest,
  ),
  monitors: query<MonitorList>('monitors:get', parseMonitorList),
  monitorsChanged: push<MonitorList>('monitors:changed', parseMonitorList),
  fonts: query<FontCatalog>('fonts:get', parseFontCatalog),
  log: message<RendererLogEntry>('log:write', parseRendererLogEntry),
};

/** The output window part of `window.llp`. */
export function outputApi(port: IpcPort) {
  const retry = port.message(outputEndpoints.retry);
  const showWindow = port.message(outputEndpoints.showWindow);
  return {
    /** Reports an output window's measured frame rate, once a second. */
    reportFrameRate: port.message(outputEndpoints.frameRate),
    /** Reports a drawn frame; false when main did not take it. */
    reportReady: port.request(outputEndpoints.frameReady),
    /**
     * Reads the status of every screen's output once. Rejects, after logging,
     * when the call fails or the answer is malformed.
     */
    getStatus: port.query(outputEndpoints.status),
    /**
     * Calls the listener whenever a screen's output status changes, with
     * every screen's status.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribeStatus: port.subscribe(outputEndpoints.statusChanged),
    /**
     * 다시 시도: tries the screen's output window again at once while the
     * restart limit holds.
     */
    retry: (screenId: string): void => retry({screenId}),
    /**
     * 모니터 다시 찾기: reads the monitor list again at once and matches each
     * screen's saved monitor again.
     */
    findMonitors: port.signal(outputEndpoints.findMonitors),
    /**
     * 창 보기: brings the screen's output window to the front without taking
     * focus, when it shows as a window.
     */
    showWindow: (screenId: string): void => showWindow({screenId}),
  };
}

/** The monitors part of `window.llp`. */
export function monitorsApi(port: IpcPort) {
  return {
    /**
     * Reads the connected monitors once. Rejects, after logging, when the call
     * fails or the answer is malformed.
     */
    get: port.query(outputEndpoints.monitors),
    /**
     * Calls the listener whenever the monitor list changes, with every
     * monitor.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(outputEndpoints.monitorsChanged),
  };
}

/** The fonts part of `window.llp`. */
export function fontsApi(port: IpcPort) {
  return {
    /** Reads installed family names and weights; rejects after logging on failure. */
    get: port.query(outputEndpoints.fonts),
  };
}

/** The log part of `window.llp`. */
export function logApi(port: IpcPort) {
  return {
    /** Writes one entry to main's log. */
    write: port.message(outputEndpoints.log),
  };
}

export type OutputApi = ReturnType<typeof outputApi>;
export type MonitorsApi = ReturnType<typeof monitorsApi>;
export type FontsApi = ReturnType<typeof fontsApi>;
export type LogApi = ReturnType<typeof logApi>;
