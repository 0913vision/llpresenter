import type {SingleLiveCommand} from '@core/live/commands';
import type {LiveState, ActiveProp} from '@core/live/state';
import type {Macro, KnownMacroAction} from '@core/schema/macros';
import type {MacroId} from '@core/schema/ids';
import type {MacroCatalog} from './catalog';

export type MacroProblemReason =
  | 'missing-target'
  | 'unknown-action'
  | 'unsupported-command'
  | 'invalid-action'
  | 'cycle'
  | 'depth-limit'
  | 'command-limit'
  | 'action-limit';

export interface MacroProblem {
  readonly macroId: MacroId;
  readonly action: number;
  readonly reason: MacroProblemReason;
  readonly target?: {readonly kind: string; readonly id: string};
  readonly message: string;
}

export interface MacroPlan {
  readonly macroId: MacroId;
  readonly commands: readonly SingleLiveCommand[];
  readonly problems: readonly MacroProblem[];
}

export interface ActionContext {
  readonly catalog: MacroCatalog;
  readonly props: Map<string, ActiveProp>;
  readonly supports: (command: SingleLiveCommand['type']) => boolean;
}

export type ActionResolution =
  | {readonly kind: 'commands'; readonly commands: readonly SingleLiveCommand[]}
  | {readonly kind: 'macro'; readonly macroId: MacroId};

export interface MacroCompileOptions {
  readonly catalog: MacroCatalog;
  readonly macro: Macro;
  readonly state: LiveState;
  readonly supports: ActionContext['supports'];
}

export type MacroActionOf<TKind extends KnownMacroAction['kind']> = Extract<
  KnownMacroAction,
  {readonly kind: TKind}
>;
