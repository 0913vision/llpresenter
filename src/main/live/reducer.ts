import type {LiveCommand} from '@shared/commands';
import type {LiveHistory} from './history';
import {registryOf} from './sliceRegistry';

export {initialHistory, type LiveHistory, type UndoEntry} from './history';

/**
 * The live reducer's slices: every module in `src/main/live/slices/`. A new
 * slice is a new file there; nothing else changes.
 */
export const liveSlices = registryOf(
  import.meta.glob<unknown>(['./slices/*.ts', '!./slices/*.test.ts'], {
    eager: true,
  }),
);

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
