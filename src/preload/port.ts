import type {
  IpcPort,
  Parse,
  PushEndpoint,
  RequestEndpoint,
  Unsubscribe,
} from '@contracts/ipc/endpoint';
import type {Result} from '@core/common/result';
import {RENDERER_LOG_LIMITS} from '@core/schema/ipcPayloads';
import type {PayloadError} from '@core/schema/payload';

/** The part of Electron's `ipcRenderer` that the port uses. */
export interface IpcRendererPort {
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => void,
  ): unknown;
  removeListener(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => void,
  ): unknown;
}

/** Logs a value that failed its check, through main's log. */
export type BadValueLog = (
  kind: 'request' | 'reply',
  channel: string,
  error: PayloadError,
) => void;

/** Writes `field: message`, or the message alone for the whole value. */
export function describe({field, message}: PayloadError): string {
  return field === '' ? message : `${field}: ${message}`;
}

/** Logs bad values on the log channel, which never answers. */
export function badValueLog(
  ipc: IpcRendererPort,
  logChannel: string,
): BadValueLog {
  return (kind, channel, error) => {
    ipc.send(logChannel, {
      level: 'error',
      message: `Ignored a bad ${kind} on ${channel}`,
      detail: describe(error).slice(0, RENDERER_LOG_LIMITS.detail),
    });
  };
}

async function invokeSafely(
  ipc: IpcRendererPort,
  channel: string,
  args: readonly unknown[],
): Promise<Result<unknown, PayloadError>> {
  try {
    const value = await ipc.invoke(channel, ...args);
    return {ok: true, value};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {ok: false, error: {field: '', message}};
  }
}

/**
 * Builds the window's side of every IPC call. A request or message that fails
 * its check is logged and never sent. A failed call or a malformed reply is
 * logged and rejects, so a window never takes a failed read for a real answer,
 * such as "no 예배 순서" or an empty live state, and keeps what it shows until
 * a push.
 */
export function createIpcPort(ipc: IpcRendererPort, log: BadValueLog): IpcPort {
  async function invokeChecked<T>(
    channel: string,
    parse: Parse<T>,
    args: readonly unknown[],
  ): Promise<T> {
    const reply = await invokeSafely(ipc, channel, args);
    const parsed = reply.ok ? parse(reply.value) : reply;
    if (parsed.ok) return parsed.value;
    log('reply', channel, parsed.error);
    throw new Error(`Bad reply on ${channel}: ${describe(parsed.error)}`);
  }

  function checked<T>(channel: string, parse: Parse<T>, value: unknown) {
    const parsed = parse(value);
    if (!parsed.ok) log('request', channel, parsed.error);
    return parsed;
  }

  function request<TRequest, TReply>(
    endpoint: RequestEndpoint<TRequest, TReply>,
  ): (value: TRequest) => Promise<TReply> {
    const {channel, refuse} = endpoint;
    return async value => {
      const parsed = checked(channel, endpoint.request, value);
      if (!parsed.ok) {
        if (refuse !== undefined) return refuse(parsed.error);
        throw new Error(`Bad request on ${channel}: ${describe(parsed.error)}`);
      }
      return invokeChecked(
        channel,
        reply => endpoint.reply(reply, parsed.value),
        [parsed.value],
      );
    };
  }

  function subscribe<TValue>(
    endpoint: PushEndpoint<TValue>,
  ): (listener: (value: TValue) => void) => Unsubscribe {
    const {channel} = endpoint;
    return listener => {
      const handler = (_event: unknown, value: unknown): void => {
        const parsed = endpoint.value(value);
        if (parsed.ok) listener(parsed.value);
        else log('reply', channel, parsed.error);
      };
      ipc.on(channel, handler);
      return () => {
        ipc.removeListener(channel, handler);
      };
    };
  }

  return {
    query:
      ({channel, reply}) =>
      () =>
        invokeChecked(channel, reply, []),
    request,
    signal:
      ({channel}) =>
      () => {
        ipc.send(channel);
      },
    message:
      ({channel, message}) =>
      value => {
        const parsed = checked(channel, message, value);
        if (parsed.ok) ipc.send(channel, parsed.value);
      },
    partialMessage:
      ({channel, message}) =>
      value => {
        const parsed = checked(channel, message, value);
        if (!parsed.ok) return;
        for (const error of parsed.value.rejected) {
          log('request', channel, error);
        }
        ipc.send(channel, parsed.value.accepted);
      },
    subscribe,
  };
}
