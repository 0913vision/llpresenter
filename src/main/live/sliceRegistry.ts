import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {LiveHistory} from './history';
import {MissingLiveTargetError} from './commandErrors';
import {
  isLiveSlice,
  type LiveSlice,
  type SliceContext,
  type SliceInputs,
} from './slice';

export type SkippedLiveCommand =
  | {readonly type: LiveCommand['type']; readonly reason: 'unhandled'}
  | {
      readonly type: LiveCommand['type'];
      readonly reason: 'missing-target';
      readonly error: MissingLiveTargetError;
    }
  | {
      readonly type: LiveCommand['type'];
      readonly reason: 'failed';
      readonly error: unknown;
    };

export interface LiveReduction {
  readonly history: LiveHistory;
  readonly skipped: readonly SkippedLiveCommand[];
}

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
      (state, slice) => ({
        ...state,
        ...slice.initial,
        layers: {...state.layers, ...slice.initial.layers},
      }),
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
    const result = this.run(history, command, {now});
    const failure = result.skipped.find(
      problem => problem.reason !== 'unhandled',
    );
    if (failure) {
      throw new Error('live reducer failed', {cause: failure.error});
    }
    return result.history;
  }

  /** Collects skipped children without exposing any intermediate state to listeners. */
  run(
    history: LiveHistory,
    command: LiveCommand,
    inputs: SliceInputs,
  ): LiveReduction {
    const skipped: SkippedLiveCommand[] = [];
    const apply = (before: LiveHistory, next: LiveCommand): LiveHistory => {
      const slice = this.byCommand.get(next.type);
      if (slice === undefined) {
        skipped.push({type: next.type, reason: 'unhandled'});
        return before;
      }
      try {
        return slice.apply(before, next, context);
      } catch (error) {
        skipped.push(
          error instanceof MissingLiveTargetError
            ? {type: next.type, reason: 'missing-target', error}
            : {type: next.type, reason: 'failed', error},
        );
        return before;
      }
    };
    const context: SliceContext = {...inputs, apply};
    return {history: apply(history, command), skipped};
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
