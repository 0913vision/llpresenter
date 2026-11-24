import type {SingleLiveCommand} from '@core/schema/live/liveCommand';
import type {LiveState} from '@core/schema/live/live';
import type {Macro, KnownMacroAction} from '@core/schema/tools/macros';
import type {MacroId} from '@core/schema/common/ids';
import type {MacroCatalog} from './catalog';
import type {ActiveProp} from '@core/schema/live/overlayState';

/** Why an action of a 매크로 was skipped. */
export type MacroProblemReason =
  | 'missing-target'
  | 'unknown-action'
  | 'unsupported-command'
  | 'invalid-action'
  | 'cycle'
  | 'depth-limit'
  | 'command-limit'
  | 'action-limit';

/**
 * One skipped action: its 매크로, its position in the action list (from 0), the
 * reason, the target it named, and a message.
 */
export interface MacroProblem {
  readonly macroId: MacroId;
  readonly action: number;
  readonly reason: MacroProblemReason;
  readonly target?: {readonly kind: string; readonly id: string};
  readonly message: string;
}

/**
 * The compiled run of a 매크로: the commands to dispatch and the problems found.
 */
export interface MacroPlan {
  readonly macroId: MacroId;
  readonly commands: readonly SingleLiveCommand[];
  readonly problems: readonly MacroProblem[];
}

/**
 * What an action compiles against: the catalog, the props the run has shown so
 * far, and whether the live store supports a command.
 */
export interface ActionContext {
  readonly catalog: MacroCatalog;
  readonly props: Map<string, ActiveProp>;
  readonly supports: (command: SingleLiveCommand['type']) => boolean;
}

/** What an action turns into: live commands, or another 매크로 to run. */
export type ActionResolution =
  | {readonly kind: 'commands'; readonly commands: readonly SingleLiveCommand[]}
  | {readonly kind: 'macro'; readonly macroId: MacroId};

/**
 * What compiling a 매크로 needs: the catalog, the 매크로, the live state, and whether
 * a command is supported.
 */
export interface MacroCompileOptions {
  readonly catalog: MacroCatalog;
  readonly macro: Macro;
  readonly state: LiveState;
  readonly supports: ActionContext['supports'];
}

/** The action type of one kind. */
export type MacroActionOf<TKind extends KnownMacroAction['kind']> = Extract<
  KnownMacroAction,
  {readonly kind: TKind}
>;
