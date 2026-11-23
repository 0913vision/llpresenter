import {
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import type {
  MessageEndpoint,
  PartialMessageEndpoint,
  PushEndpoint,
  QueryEndpoint,
  RequestEndpoint,
  SignalEndpoint,
} from '@contracts/ipc/endpoint';
import type {Logger} from './log';

/** The window a call came from. */
export interface Caller {
  readonly contents: WebContents;
  /** Not from a frame inside the page. */
  readonly isMainFrame: boolean;
}

type Log = Pick<Logger, 'warn' | 'error'>;

/** What a value is sent to. */
interface Receiver {
  isDestroyed(): boolean;
  send(channel: string, value: unknown): void;
}

/** Sends a value to one window; what fails is logged, and answers false. */
export function pushToWindow<TValue>(
  contents: Receiver,
  {channel}: PushEndpoint<TValue>,
  {value, log}: {readonly value: TValue; readonly log: Log},
): boolean {
  if (contents.isDestroyed()) return false;
  try {
    contents.send(channel, value);
    return true;
  } catch (error) {
    log.warn(`could not send ${channel} to a window`, error);
    return false;
  }
}

/** Sends a value to every open window. */
export function pushToWindows<TValue>(
  endpoint: PushEndpoint<TValue>,
  value: TValue,
  log: Log,
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      pushToWindow(win.webContents, endpoint, {value, log});
    }
  }
}

function callerOf({
  sender,
  senderFrame,
}: IpcMainEvent | IpcMainInvokeEvent): Caller {
  return {contents: sender, isMainFrame: senderFrame === sender.mainFrame};
}

/**
 * Main's end of the calls between the processes. It checks every request and
 * message with the parsers of its endpoint, so that a handler only ever sees
 * valid values: what fails is logged and refused or dropped.
 */
export class IpcHost {
  private readonly stops: Array<() => void> = [];

  constructor(private readonly log: Log) {}

  /** Answers a call without an argument. */
  query<TReply>(
    {channel}: QueryEndpoint<TReply>,
    answer: (caller: Caller) => TReply | Promise<TReply>,
  ): void {
    this.handle(channel, event => answer(callerOf(event)));
  }

  /** Answers a call with one argument. */
  request<TRequest, TReply>(
    {channel, request, refuse}: RequestEndpoint<TRequest, TReply>,
    answer: (request: TRequest, caller: Caller) => TReply | Promise<TReply>,
  ): void {
    this.handle(channel, (event, value) => {
      const parsed = request(value);
      if (parsed.ok) return answer(parsed.value, callerOf(event));
      this.log.warn(`refused a malformed ${channel} request`, parsed.error);
      if (refuse !== undefined) return refuse(parsed.error);
      throw new Error(`Malformed ${channel} request`);
    });
  }

  /** Hears a message without an argument. */
  signal({channel}: SignalEndpoint, hear: (caller: Caller) => void): void {
    this.listen(channel, event => hear(callerOf(event)));
  }

  /** Hears a message with one argument. */
  message<TMessage>(
    {channel, message}: MessageEndpoint<TMessage>,
    hear: (message: TMessage, caller: Caller) => void,
  ): void {
    this.listen(channel, (event, value) => {
      const parsed = message(value);
      if (parsed.ok) hear(parsed.value, callerOf(event));
      else this.drop(channel, parsed.error);
    });
  }

  /** Hears a message whose parts are checked one by one. */
  partialMessage<TMessage>(
    {channel, message}: PartialMessageEndpoint<TMessage>,
    hear: (message: TMessage, caller: Caller) => void,
  ): void {
    this.listen(channel, (event, value) => {
      const parsed = message(value);
      if (!parsed.ok) {
        this.drop(channel, parsed.error);
        return;
      }
      for (const error of parsed.value.rejected) this.drop(channel, error);
      hear(parsed.value.accepted, callerOf(event));
    });
  }

  /** Sends a value to every open window. */
  push<TValue>(endpoint: PushEndpoint<TValue>, value: TValue): void {
    pushToWindows(endpoint, value, this.log);
  }

  /** Does something more when this closes. */
  whenClosed(stop: () => void): void {
    this.stops.push(stop);
  }

  /** Stops answering and hearing everything; one that fails stops no other. */
  close(): void {
    for (const stop of this.stops.splice(0)) {
      try {
        stop();
      } catch (error) {
        this.log.error('could not stop answering the windows', error);
      }
    }
  }

  private drop(channel: string, error: unknown): void {
    this.log.warn(`dropped a malformed ${channel} message`, error);
  }

  private handle(
    channel: string,
    answer: (event: IpcMainInvokeEvent, value: unknown) => unknown,
  ): void {
    ipcMain.handle(channel, answer);
    this.stops.push(() => {
      ipcMain.removeHandler(channel);
    });
  }

  private listen(
    channel: string,
    hear: (event: IpcMainEvent, value: unknown) => void,
  ): void {
    ipcMain.on(channel, hear);
    this.stops.push(() => {
      ipcMain.removeListener(channel, hear);
    });
  }
}
