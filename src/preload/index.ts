import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron';
import {Channels, type LlpApi, type Unsubscribe} from '@shared/ipc';
import type {Result} from '@shared/result';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {parseLiveState} from '@shared/schema/liveState';
import type {PayloadError} from '@shared/schema/payload';
import {parseOutputStatuses} from '@shared/schema/outputStatus';
import {parseShowService} from '@shared/schema/showService';
import {parseUiState} from '@shared/schema/uiState';

type Parse<T> = (value: unknown) => Result<T, PayloadError>;

function listen<T>(
  channel: string,
  parse: Parse<T>,
  listener: (value: T) => void,
): Unsubscribe {
  const handler = (_event: IpcRendererEvent, value: unknown): void => {
    const parsed = parse(value);
    if (parsed.ok) {
      listener(parsed.value);
    } else {
      logBadReply(channel, parsed.error);
    }
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// NOTE(0913vision): A failed call or a malformed reply is logged and rejects,
// so a window never takes a failed read for a real answer, such as "no 예배
// 순서" or an empty live state, and keeps what it shows until a push.
async function invokeChecked<T>(channel: string, parse: Parse<T>): Promise<T> {
  const reply = await invokeSafely(channel);
  const parsed = reply.ok ? parse(reply.value) : reply;
  if (parsed.ok) {
    return parsed.value;
  }
  logBadReply(channel, parsed.error);
  throw new Error(`Bad reply on ${channel}: ${describe(parsed.error)}`);
}

async function invokeSafely(
  channel: string,
): Promise<Result<unknown, PayloadError>> {
  try {
    const value: unknown = await ipcRenderer.invoke(channel);
    return {ok: true, value};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {ok: false, error: {field: '', message}};
  }
}

function logBadReply(channel: string, error: PayloadError): void {
  ipcRenderer.send(Channels.logWrite, {
    level: 'error',
    message: `Ignored a bad reply on ${channel}`,
    detail: describe(error).slice(0, RENDERER_LOG_LIMITS.detail),
  });
}

function describe({field, message}: PayloadError): string {
  return field === '' ? message : `${field}: ${message}`;
}

const api: LlpApi = {
  live: {
    get: () => invokeChecked(Channels.liveGet, parseLiveState),
    send: command => ipcRenderer.send(Channels.liveCommand, command),
    subscribe: listener =>
      listen(Channels.liveChanged, parseLiveState, listener),
  },
  window: {
    control: action => ipcRenderer.send(Channels.windowControl, action),
  },
  ui: {
    get: () => invokeChecked(Channels.uiGet, parseUiState),
    setLayout: change => ipcRenderer.send(Channels.uiLayoutSet, change),
  },
  log: {
    write: entry => ipcRenderer.send(Channels.logWrite, entry),
  },
  output: {
    reportFrameRate: report =>
      ipcRenderer.send(Channels.outputFrameRate, report),
    getStatus: () =>
      invokeChecked(Channels.outputStatusGet, parseOutputStatuses),
    subscribeStatus: listener =>
      listen(Channels.outputStatusChanged, parseOutputStatuses, listener),
    retry: screenId => ipcRenderer.send(Channels.outputRetry, {screenId}),
  },
  service: {
    get: () => invokeChecked(Channels.serviceGet, parseShowService),
    subscribe: listener =>
      listen(Channels.serviceChanged, parseShowService, listener),
  },
};

contextBridge.exposeInMainWorld('llp', api);
