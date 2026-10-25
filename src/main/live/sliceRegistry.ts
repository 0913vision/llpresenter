import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {LiveHistory} from './history';
import type {PayloadError} from '@shared/schema/payload';
import {parseLiveState} from '@shared/schema/liveState';
import {MAX_LIVE_BATCH_COMMANDS} from '@shared/schema/liveCommand';
import {fitsLiveStateByteBudget} from './stateBudget';
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
      readonly reason: 'invalid-overlay';
      readonly error: PayloadError;
    }
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

const MAX_ATTEMPT_EFFECTS =
  MAX_LIVE_BATCH_COMMANDS * (MAX_LIVE_BATCH_COMMANDS + 1);

interface DeferredEffect {
  readonly type: LiveCommand['type'];
  readonly run: () => void;
}

interface ReductionAttempt extends LiveReduction {
  readonly effects: readonly DeferredEffect[];
}

function stateProblem(state: LiveState): PayloadError | undefined {
  const parsed = parseLiveState(state);
  if (!parsed.ok) return parsed.error;
  return fitsLiveStateByteBudget(state)
    ? undefined
    : {
        field: '',
        message: 'The live state exceeds its byte budget',
      };
}

function selectAttempt(attempt: ReductionAttempt): LiveReduction {
  const skipped = [...attempt.skipped];
  for (const effect of attempt.effects) {
    try {
      effect.run();
    } catch (error: unknown) {
      skipped.push({type: effect.type, reason: 'failed', error});
    }
  }
  return {history: attempt.history, skipped};
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
   * @returns The same history object when nothing changed, no slice handles the
   * command, or its proposed overlay fails validation.
   */
  apply(history: LiveHistory, command: LiveCommand, now: number): LiveHistory {
    const result = this.run(history, command, {now});
    const failure = result.skipped.find(
      problem =>
        problem.reason === 'failed' || problem.reason === 'missing-target',
    );
    if (failure) {
      throw new Error('live reducer failed', {cause: failure.error});
    }
    return result.history;
  }

  /**
   * Reduces a command and its children without exposing intermediate state,
   * then checks the final state once. When that check fails, the whole dispatch
   * is rejected: the history stays as it was and no deferred observation runs.
   */
  run(
    history: LiveHistory,
    command: LiveCommand,
    inputs: SliceInputs,
  ): LiveReduction {
    const attempt = this.reduce(history, command, inputs);
    if (attempt.history.state === history.state) return selectAttempt(attempt);
    const error = stateProblem(attempt.history.state);
    if (error === undefined) return selectAttempt(attempt);
    return {
      history,
      skipped: [
        ...attempt.skipped,
        {type: command.type, reason: 'invalid-overlay', error},
      ],
    };
  }

  private reduce(
    history: LiveHistory,
    command: LiveCommand,
    inputs: SliceInputs,
  ): ReductionAttempt {
    const skipped: SkippedLiveCommand[] = [];
    const effects: DeferredEffect[] = [];
    const apply = (before: LiveHistory, next: LiveCommand): LiveHistory => {
      const slice = this.byCommand.get(next.type);
      if (slice === undefined) {
        skipped.push({type: next.type, reason: 'unhandled'});
        return before;
      }
      const context: SliceContext = {
        ...inputs,
        apply,
        defer: effect => {
          if (effects.length >= MAX_ATTEMPT_EFFECTS) {
            throw new Error('Too many deferred live observations');
          }
          effects.push({type: next.type, run: effect});
        },
        reject: error => {
          skipped.push({type: next.type, reason: 'invalid-overlay', error});
          return before;
        },
      };
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
    return {history: apply(history, command), skipped, effects};
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
