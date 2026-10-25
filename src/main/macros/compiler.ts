import type {SingleLiveCommand} from '@shared/commands';
import {
  MAX_LIVE_BATCH_COMMANDS,
  parseLiveCommand,
} from '@shared/schema/liveCommand';
import {
  isKnownMacroAction,
  type Macro,
  type MacroAction,
} from '@shared/schema/macros';
import type {MacroId} from '@shared/schema/ids';
import {parseActiveProps} from '@shared/schema/overlayState';
import {MissingLiveTargetError} from '../live/commandErrors';
import {macroActions} from './actions';
import type {MacroActionRegistry} from './actionRegistry';
import type {
  ActionContext,
  MacroCompileOptions,
  MacroPlan,
  MacroProblem,
} from './types';

export const MACRO_EXECUTION_LIMITS = {
  depth: 4,
  actions: MAX_LIVE_BATCH_COMMANDS,
  problems: MAX_LIVE_BATCH_COMMANDS,
  message: 200,
} as const;

function projectProps(
  command: SingleLiveCommand,
  context: ActionContext,
): void {
  if (!context.supports(command.type)) return;
  if (
    command.type === 'layer.clear' &&
    (command.target === 'all' || command.target === 'prop')
  ) {
    context.props.clear();
  } else if (command.type === 'prop.set') {
    if (!command.on) {
      context.props.delete(command.propId);
      return;
    }
    const prop = context.catalog.props.props.find(
      item => item.id === command.propId,
    );
    if (prop === undefined) {
      throw new MissingLiveTargetError({kind: 'prop', id: command.propId});
    }
    const next = new Map(context.props);
    next.set(prop.id, {
      propId: prop.id,
      content: prop.content,
      targets: [...new Set(prop.targets)],
    });
    const parsed = parseActiveProps([...next.values()]);
    if (!parsed.ok) {
      throw new Error(`${parsed.error.field}: ${parsed.error.message}`);
    }
    context.props.clear();
    for (const item of parsed.value) context.props.set(item.propId, item);
  }
}

type ActionLocation = Pick<MacroProblem, 'macroId' | 'action'>;

class MacroCompiler {
  private readonly commands: SingleLiveCommand[] = [];
  private readonly problems: MacroProblem[] = [];
  private readonly context: ActionContext;
  private visited = 0;
  private limited = false;

  constructor(
    private readonly options: MacroCompileOptions,
    private readonly registry: MacroActionRegistry,
  ) {
    this.context = {
      catalog: options.catalog,
      supports: options.supports,
      props: new Map(
        (options.state.layers.prop?.items ?? []).map(item => [
          item.propId,
          item,
        ]),
      ),
    };
  }

  compile(): MacroPlan {
    this.visit(this.options.macro, [this.options.macro.id]);
    return {
      macroId: this.options.macro.id,
      commands: this.commands,
      problems: this.problems,
    };
  }

  private report(problem: MacroProblem): void {
    if (this.problems.length >= MACRO_EXECUTION_LIMITS.problems) return;
    this.problems.push({
      ...problem,
      message: problem.message.slice(0, MACRO_EXECUTION_LIMITS.message),
    });
  }

  private visit(macro: Macro, chain: readonly string[]): void {
    for (const [index, action] of macro.actions.entries()) {
      if (this.limited) return;
      const location = {macroId: macro.id, action: index};
      if (this.visited >= MACRO_EXECUTION_LIMITS.actions) {
        this.limited = true;
        this.report({
          ...location,
          reason: 'action-limit',
          message: 'Macro action budget exceeded',
        });
        return;
      }
      this.visited++;
      try {
        this.action(action, location, chain);
      } catch (error: unknown) {
        this.report(
          error instanceof MissingLiveTargetError
            ? {
                ...location,
                reason: 'missing-target',
                target: error.target,
                message: error.message,
              }
            : {
                ...location,
                reason: 'invalid-action',
                message: error instanceof Error ? error.message : String(error),
              },
        );
      }
    }
  }

  private action(
    action: MacroAction,
    location: ActionLocation,
    chain: readonly string[],
  ): void {
    const resolution = isKnownMacroAction(action)
      ? this.registry.compile(action, this.context)
      : null;
    if (resolution === null) {
      this.report({
        ...location,
        reason: 'unknown-action',
        message: `Unknown macro action: ${action.kind.slice(0, 64)}`,
      });
    } else if (resolution.kind === 'macro') {
      this.nested(resolution.macroId, location, chain);
    } else {
      for (const command of resolution.commands) {
        if (this.limited) return;
        this.emit(command, location);
      }
    }
  }

  private nested(
    id: MacroId,
    location: ActionLocation,
    chain: readonly string[],
  ): void {
    const target = {kind: 'macro', id};
    if (chain.includes(id)) {
      this.report({
        ...location,
        reason: 'cycle',
        target,
        message: 'Macro is already running in this chain',
      });
      return;
    }
    if (chain.length >= MACRO_EXECUTION_LIMITS.depth) {
      this.report({
        ...location,
        reason: 'depth-limit',
        target,
        message: 'Macro depth limit exceeded',
      });
      return;
    }
    const macro = this.options.catalog.macros.macros.find(
      item => item.id === id,
    );
    if (macro === undefined) throw new MissingLiveTargetError(target);
    this.visit(macro, [...chain, id]);
  }

  private emit(command: SingleLiveCommand, location: ActionLocation): void {
    if (this.commands.length >= MAX_LIVE_BATCH_COMMANDS) {
      this.limited = true;
      this.report({
        ...location,
        reason: 'command-limit',
        message: 'Macro command budget exceeded',
      });
      return;
    }
    const parsed = parseLiveCommand(command);
    if (!parsed.ok) {
      throw new Error(`${parsed.error.field}: ${parsed.error.message}`);
    }
    if (parsed.value.type === 'live.batch') {
      throw new Error('An action cannot return a nested batch');
    }
    projectProps(parsed.value, this.context);
    this.commands.push(parsed.value);
    if (!this.context.supports(command.type)) {
      this.report({
        ...location,
        reason: 'unsupported-command',
        message: `No live slice handles ${command.type}`,
      });
    }
  }
}

/** Flattens a bounded chain into one batch's commands without changing live state. */
export function compileMacro(
  options: MacroCompileOptions,
  registry: MacroActionRegistry = macroActions,
): MacroPlan {
  return new MacroCompiler(options, registry).compile();
}
