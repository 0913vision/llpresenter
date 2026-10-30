import type {LiveCommand} from '@core/live/commands';
import type {Result} from '@core/common/result';
import {parseLiveCommandRequest} from '@core/schema/liveCommand';
import type {LiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import type {PayloadError} from '@core/schema/payload';
import {parseTimerClockReading} from '@core/schema/timerState';
import {Channels} from './channels';
import {
  partialMessage,
  push,
  query,
  type IpcPort,
  type PartialMessage,
} from './endpoint';

function parseLiveCommandParts(
  value: unknown,
): Result<PartialMessage<LiveCommand>, PayloadError> {
  const parsed = parseLiveCommandRequest(value);
  if (!parsed.ok) return parsed;
  const {command, rejected} = parsed.value;
  return {ok: true, value: {accepted: command, rejected}};
}

/** The live output calls. Main owns the live state; windows send commands. */
export const liveEndpoints = {
  get: query<LiveState>(Channels.liveGet, parseLiveState),
  clock: query<number>(Channels.liveClock, parseTimerClockReading),
  command: partialMessage<LiveCommand>(
    Channels.liveCommand,
    parseLiveCommandParts,
  ),
  changed: push<LiveState>(Channels.liveChanged, parseLiveState),
};

/** The live output part of `window.llp`. */
export function liveApi(port: IpcPort) {
  return {
    /**
     * Reads the live state once. Rejects, after logging, when the call fails or
     * the answer is malformed; a push brings the state later.
     */
    get: port.query(liveEndpoints.get),
    /**
     * Sends a command. The parts of a batch that fail their check are logged
     * and dropped; the rest is sent.
     */
    send: port.partialMessage(liveEndpoints.command),
    /**
     * Calls the listener on every state change.
     *
     * @returns A function that removes the listener. Always call it.
     */
    subscribe: port.subscribe(liveEndpoints.changed),
    /**
     * Reads main's monotonic 타이머 clock, in epoch-like milliseconds, so a
     * window can read 타이머 runs. Rejects, after logging, when the call fails.
     */
    clock: port.query(liveEndpoints.clock),
  };
}

export type LiveApi = ReturnType<typeof liveApi>;
