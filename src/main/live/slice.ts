import type {LiveCommand, LiveCommandType} from '@shared/commands';
import type {LiveLayers, LiveState} from '@shared/live';
import type {LiveHistory} from './history';

/** The commands of the given types. */
export type CommandOf<T extends LiveCommandType> = Extract<
  LiveCommand,
  {readonly type: T}
>;

/** The state fields initialized by a slice, including individual layers. */
export type SliceInitial = Omit<Partial<LiveState>, 'layers'> & {
  readonly layers?: Partial<LiveLayers>;
};

/** The initial state and reducer for a bounded set of command types. */
export interface SliceDefinition<T extends LiveCommandType> {
  /** The command types this slice handles. No other slice may handle them. */
  readonly commands: readonly T[];
  /** This slice's part of the initial live state. */
  readonly initial: SliceInitial;
  /**
   * Applies one of its commands. Returns the same history object when nothing
   * changed, so the store can skip the broadcast.
   *
   * @param now - The time of the command in milliseconds since the epoch.
   */
  readonly reduce: (
    history: LiveHistory,
    command: CommandOf<T>,
    now: number,
  ) => LiveHistory;
}

const SLICE = Symbol('live slice');

/** A slice as the registry holds it: its command types and a reducer for them. */
export interface LiveSlice {
  readonly [SLICE]: true;
  readonly commands: readonly LiveCommandType[];
  readonly initial: SliceInitial;
  /** Applies a command of its types; any other command leaves the history as it is. */
  apply(history: LiveHistory, command: LiveCommand, now: number): LiveHistory;
}

/**
 * Declares a slice of the live reducer. A module in `src/main/live/slices/`
 * exports the value, and the registry finds it there.
 */
export function defineSlice<T extends LiveCommandType>(
  definition: SliceDefinition<T>,
): LiveSlice {
  const handles = (command: LiveCommand): command is CommandOf<T> =>
    definition.commands.some(type => type === command.type);
  return {
    [SLICE]: true,
    commands: definition.commands,
    initial: definition.initial,
    apply: (history, command, now) =>
      handles(command) ? definition.reduce(history, command, now) : history,
  };
}

export function isLiveSlice(value: unknown): value is LiveSlice {
  return typeof value === 'object' && value !== null && SLICE in value;
}
