import type {MacroId, ServiceItemId} from '@shared/schema/ids';
import {parseMacroId} from '@shared/schema/ids';
import type {ServiceItem} from '@shared/schema/service';
import type {MediaList} from '@shared/schema/mediaList';
import type {LiveHistory} from '../live/history';
import type {CommandOf, SliceContext} from '../live/slice';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import {readMacroCatalog} from './catalog';
import {compileMacro} from './compiler';
import {requireMacroTarget} from './actions';
import type {ActionContext, MacroCommandPort, MacroPlan} from './types';

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
        : this.itemMacro(command.itemId);
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
    const plan = compileMacro({
      catalog,
      macro,
      state: history.state,
      supports: this.options.supports,
    });
    this.latest = plan;
    for (const problem of plan.problems) {
      if (problem.reason !== 'unsupported-command') {
        this.options.log.warn('skipped macro action', problem);
      }
    }
    return context.apply(history, {
      type: 'live.batch',
      commands: plan.commands,
    });
  }

  startupIds(): readonly MacroId[] {
    const document = this.options.settings.get('macros');
    return document.name === 'macros'
      ? document.value.macros
          .filter(macro => macro.runOnStartup === true)
          .map(macro => macro.id)
      : [];
  }

  private itemMacro(itemId: ServiceItemId): MacroId | undefined {
    const item = requireMacroTarget(
      this.options.item(itemId),
      'service-item',
      itemId,
    );
    if (!('macro' in item)) return undefined;
    const parsed = parseMacroId(item.macro);
    if (!parsed.ok) throw new Error('Item start macro ID is invalid');
    return parsed.value;
  }
}
