import type {MacroId, ServiceItemId} from '@shared/schema/ids';
import {parseMacroId} from '@shared/schema/ids';
import type {ServiceItem} from '@shared/schema/service';
import type {MediaList} from '@shared/schema/mediaList';
import type {LiveHistory} from '../live/history';
import type {CommandOf, MacroCommandPort, SliceContext} from '../live/slice';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import {readMacroCatalog} from './catalog';
import {compileMacro} from './compiler';
import {requireMacroTarget} from './actions';
import type {ActionContext, MacroPlan} from './types';

export const MAX_LOGGED_MACRO_PROBLEMS = 5;

export interface MacroRunnerOptions {
  readonly settings: SettingsReader;
  readonly media: () => MediaList;
  readonly item: (id: ServiceItemId) => ServiceItem | undefined;
  readonly supports: ActionContext['supports'];
  readonly log: Logger;
}

/** Compiles against the latest catalog and reduces through the existing batch transaction. */
export class MacroRunner implements MacroCommandPort {
  private latest: MacroPlan | null = null;

  constructor(private readonly options: MacroRunnerOptions) {}

  get lastRun(): MacroPlan | null {
    return this.latest;
  }

  run(
    history: LiveHistory,
    command: CommandOf<'macro.run' | 'item.start'>,
    context: SliceContext,
  ): LiveHistory {
    const id =
      command.type === 'macro.run'
        ? command.macroId
        : this.itemMacro(command.itemId, context);
    if (id === undefined) return history;
    const catalog = readMacroCatalog(
      this.options.settings,
      this.options.media(),
    );
    const macro = requireMacroTarget(
      catalog.macros.macros.find(item => item.id === id),
      'macro',
      id,
    );
    context.ranMacro({macroId: macro.id, name: macro.name});
    const plan = compileMacro({
      catalog,
      macro,
      state: history.state,
      supports: this.options.supports,
    });
    context.defer(() => {
      this.report(plan);
    });
    const next = context.apply(history, {
      type: 'live.batch',
      commands: plan.commands,
    });
    if (next.state.lastMacroId === macro.id) return next;
    return {
      ...next,
      state: {
        ...next.state,
        version: next === history ? next.state.version + 1 : next.state.version,
        lastMacroId: macro.id,
      },
    };
  }

  private report(plan: MacroPlan): void {
    this.latest = plan;
    const problems = plan.problems.filter(
      problem => problem.reason !== 'unsupported-command',
    );
    if (problems.length > 0) {
      this.options.log.warn('skipped macro actions', {
        macroId: plan.macroId,
        count: problems.length,
        problems: problems.slice(0, MAX_LOGGED_MACRO_PROBLEMS),
      });
    }
  }

  startupIds(): readonly MacroId[] {
    const document = this.options.settings.get('macros');
    return document.name === 'macros'
      ? document.value.macros
          .filter(macro => macro.runOnStartup === true)
          .map(macro => macro.id)
      : [];
  }

  private itemMacro(
    itemId: ServiceItemId,
    context: SliceContext,
  ): MacroId | undefined {
    const item = requireMacroTarget(
      this.options.item(itemId),
      'service-item',
      itemId,
    );
    if (!('macro' in item)) return undefined;
    const parsed = parseMacroId(item.macro);
    if (!parsed.ok) {
      context.defer(() => {
        this.options.log.warn('skipped invalid item start macro', {
          itemId,
          reason: 'invalid-action',
          error: parsed.error,
        });
      });
      return undefined;
    }
    return parsed.value;
  }
}
