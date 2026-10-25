import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {LiveHistory} from './history';
import {isLiveSlice, type LiveSlice} from './slice';

/**
 * The slices of the live reducer, one per command type. A command type that no
 * slice handles leaves the history unchanged, so a command added to the shared
 * contract before its slice lands is harmless.
 */
export class SliceRegistry {
  private readonly byCommand = new Map<string, LiveSlice>();

  /** @throws When two slices handle the same command type. */
  constructor(private readonly slices: readonly LiveSlice[]) {
    for (const slice of slices) {
      for (const type of slice.commands) {
        if (this.byCommand.has(type)) {
          throw new Error(`two live slices handle ${type}`);
        }
        this.byCommand.set(type, slice);
      }
    }
  }

  handles(type: string): boolean {
    return this.byCommand.has(type);
  }

  initialState(): LiveState {
    return this.slices.reduce<LiveState>(
      (state, slice) => ({...state, ...slice.initial}),
      emptyLiveState(),
    );
  }

  /**
   * Applies a command through its slice.
   *
   * @returns The same history object when nothing changed or no slice handles
   * the command.
   */
  apply(history: LiveHistory, command: LiveCommand, now: number): LiveHistory {
    const slice = this.byCommand.get(command.type);
    return slice === undefined ? history : slice.apply(history, command, now);
  }
}

function slicesOf(path: string, module: unknown): LiveSlice[] {
  const values: unknown[] =
    typeof module === 'object' && module !== null ? Object.values(module) : [];
  const slices = values.filter(isLiveSlice);
  if (slices.length === 0) throw new Error(`${path} exports no live slice`);
  return slices;
}

/**
 * Builds a registry from slice modules, as an eager `import.meta.glob` gives
 * them.
 *
 * @throws When a module exports no slice or two slices handle the same command
 * type. Both are mistakes in the code, which the tests catch.
 */
export function registryOf(
  modules: Readonly<Record<string, unknown>>,
): SliceRegistry {
  return new SliceRegistry(
    Object.entries(modules).flatMap(([path, module]) => slicesOf(path, module)),
  );
}
