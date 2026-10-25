import type {LiveCommand} from '@shared/commands';
import type {LiveHistory} from './history';
import {liveSlices} from './slices';

export {initialHistory, type LiveHistory, type UndoEntry} from './history';
export {liveSlices} from './slices';

/**
 * Applies one command. This is a pure function, so it is tested without
 * Electron.
 *
 * @param now - The time of the command in milliseconds since the epoch, for
 * the start time of a background and the time of a clear.
 * @returns The same history object when nothing changed or no slice handles
 * the command, so callers can skip the broadcast.
 */
export function applyCommand(
  history: LiveHistory,
  command: LiveCommand,
  now: number,
): LiveHistory {
  return liveSlices.apply(history, command, now);
}
