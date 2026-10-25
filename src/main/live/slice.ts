import type {LiveCommand, LiveCommandType} from '@shared/commands';
import type {LiveLayers, LiveState} from '@shared/live';
import type {LiveHistory} from './history';
import type {SettingsReader} from '../store/settingsStore';
import type {MessageId, ScreenId} from '@shared/schema/ids';
import type {PayloadError} from '@shared/schema/payload';

export interface MacroCommandPort {
  run(
    history: LiveHistory,
    command: CommandOf<'macro.run' | 'item.start'>,
    context: SliceContext,
  ): LiveHistory;
}

export interface SliceInputs {
  readonly now: number;
  readonly settings?: SettingsReader;
  readonly nextMessageId?: () => MessageId;
  readonly resyncScreen?: (screenId: ScreenId) => void;
  readonly macros?: MacroCommandPort;
}

/** The commands of the given types. */
export type CommandOf<T extends LiveCommandType> = Extract<
  LiveCommand,
  {readonly type: T}
>;

/** The state fields initialized by a slice, including individual layers. */
export type SliceInitial = Omit<Partial<LiveState>, 'layers'> & {
  readonly layers?: Partial<LiveLayers>;
};

/** The command time and the same registry path for a transaction's children. */
export interface SliceContext extends SliceInputs {
  /** Defers an observation until this reduction attempt is selected. */
  readonly defer?: (effect: () => void) => void;
  /** Records a validation skip and returns this command's unchanged history. */
  readonly reject: (error: PayloadError) => LiveHistory;
  readonly apply: (history: LiveHistory, command: LiveCommand) => LiveHistory;
}

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
   * @param context - The command time and child-command dispatcher.
   */
  readonly reduce: (
    history: LiveHistory,
    command: CommandOf<T>,
    context: SliceContext,
  ) => LiveHistory;
}

const SLICE = Symbol('live slice');

/** A slice as the registry holds it: its command types and a reducer for them. */
export interface LiveSlice {
  readonly [SLICE]: true;
  readonly commands: readonly LiveCommandType[];
  readonly initial: SliceInitial;
  /** Applies a command of its types; any other command leaves the history as it is. */
  apply(
    history: LiveHistory,
    command: LiveCommand,
    context: SliceContext,
  ): LiveHistory;
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
    apply: (history, command, context) =>
      handles(command) ? definition.reduce(history, command, context) : history,
  };
}

export function isLiveSlice(value: unknown): value is LiveSlice {
  return typeof value === 'object' && value !== null && SLICE in value;
}
