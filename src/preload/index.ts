import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron';
import {Channels, type LlpApi, type Unsubscribe} from '@shared/ipc';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {Result} from '@shared/result';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {parseLiveState} from '@shared/schema/liveState';
import type {PayloadError} from '@shared/schema/payload';
import {parseUiState, type UiState} from '@shared/schema/uiState';

type Parse<T> = (value: unknown) => Result<T, PayloadError>;

function listen(
  channel: string,
  listener: (state: LiveState) => void,
): Unsubscribe {
  const handler = (_event: IpcRendererEvent, value: unknown): void => {
    const state = parseLiveState(value);
    if (state.ok) {
      listener(state.value);
    } else {
      logBadReply(channel, state.error);
    }
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// NOTE(0913vision): A failed call or a malformed reply is logged and gives the
// fallback, so a window never starts from bad data.
async function invokeChecked<T>(
  channel: string,
  parse: Parse<T>,
  fallback: () => T,
): Promise<T> {
  const reply = await invokeSafely(channel);
  const parsed = reply.ok ? parse(reply.value) : reply;
  if (parsed.ok) {
    return parsed.value;
  }
  logBadReply(channel, parsed.error);
  return fallback();
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

function logBadReply(channel: string, {field, message}: PayloadError): void {
  ipcRenderer.send(Channels.logWrite, {
    level: 'error',
    message: `Ignored a bad reply on ${channel}`,
    detail: (field === '' ? message : `${field}: ${message}`).slice(
      0,
      RENDERER_LOG_LIMITS.detail,
    ),
  });
}

const emptyUiState = (): UiState => ({});

const api: LlpApi = {
  live: {
    get: () => invokeChecked(Channels.liveGet, parseLiveState, emptyLiveState),
    send: command => ipcRenderer.send(Channels.liveCommand, command),
    subscribe: listener => listen(Channels.liveChanged, listener),
  },
  window: {
    control: action => ipcRenderer.send(Channels.windowControl, action),
  },
  ui: {
    get: () => invokeChecked(Channels.uiGet, parseUiState, emptyUiState),
    setLayout: change => ipcRenderer.send(Channels.uiLayoutSet, change),
  },
  log: {
    write: entry => ipcRenderer.send(Channels.logWrite, entry),
  },
  output: {
    reportFrameRate: report =>
      ipcRenderer.send(Channels.outputFrameRate, report),
  },
};

contextBridge.exposeInMainWorld('llp', api);
