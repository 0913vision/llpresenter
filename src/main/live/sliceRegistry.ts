import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {LiveHistory} from './history';
import type {PayloadError} from '@core/schema/payload';
import {parseLiveState} from '@core/schema/liveState';
import {MAX_LIVE_BATCH_COMMANDS} from '@core/schema/liveCommand';
import {fitsLiveStateByteBudget} from './stateBudget';
import {MissingLiveTargetError} from './commandErrors';
import {
  isLiveSlice,
  type LiveSlice,
  type RanMacro,
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
    }
  | {
      readonly type: LiveCommand['type'];
      readonly reason: 'dropped';
      readonly error: PayloadError;
      /** The 매크로 that the dropped dispatch ran, in order. */
      readonly macros: readonly RanMacro[];
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
  readonly macros: readonly RanMacro[];
}

interface RecordMark {
  readonly effects: number;
  readonly macros: number;
}

class ReductionRecord {
  readonly skipped: SkippedLiveCommand[] = [];
  readonly effects: DeferredEffect[] = [];
  readonly macros: RanMacro[] = [];

  mark(): RecordMark {
    return {effects: this.effects.length, macros: this.macros.length};
  }

  skip(mark: RecordMark, problem: SkippedLiveCommand): void {
    this.effects.length = mark.effects;
    this.macros.length = mark.macros;
    this.skipped.push(problem);
  }

  defer(type: LiveCommand['type'], run: () => void): void {
    if (this.effects.length >= MAX_ATTEMPT_EFFECTS) {
      throw new Error('Too many deferred live observations');
    }
    this.effects.push({type, run});
  }

  ranMacro(macro: RanMacro): void {
    if (this.macros.length >= MAX_LIVE_BATCH_COMMANDS) {
      throw new Error('Too many macros in one dispatch');
    }
    this.macros.push(macro);
  }
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
        {type: command.type, reason: 'dropped', error, macros: attempt.macros},
      ],
    };
  }

  private reduce(
    history: LiveHistory,
    command: LiveCommand,
    inputs: SliceInputs,
  ): ReductionAttempt {
    const record = new ReductionRecord();
    const apply = (before: LiveHistory, next: LiveCommand): LiveHistory => {
      const slice = this.byCommand.get(next.type);
      if (slice === undefined) {
        record.skipped.push({type: next.type, reason: 'unhandled'});
        return before;
      }
      const mark = record.mark();
      const context: SliceContext = {
        ...inputs,
        apply,
        defer: effect => {
          record.defer(next.type, effect);
        },
        ranMacro: macro => {
          record.ranMacro(macro);
        },
        reject: error => {
          record.skip(mark, {
            type: next.type,
            reason: 'invalid-overlay',
            error,
          });
          return before;
        },
      };
      try {
        return slice.apply(before, next, context);
      } catch (error) {
        record.skip(
          mark,
          error instanceof MissingLiveTargetError
            ? {type: next.type, reason: 'missing-target', error}
            : {type: next.type, reason: 'failed', error},
        );
        return before;
      }
    };
    const after = apply(history, command);
    return {
      history: after,
      skipped: record.skipped,
      effects: record.effects,
      macros: record.macros,
    };
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
