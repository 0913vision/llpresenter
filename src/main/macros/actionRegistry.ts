import type {KnownMacroAction, MacroActionKind} from '@core/schema/macros';
import type {ActionContext, ActionResolution, MacroActionOf} from './types';

interface ActionDefinition<TKind extends MacroActionKind> {
  readonly kind: TKind;
  readonly compile: (
    action: MacroActionOf<TKind>,
    context: ActionContext,
  ) => ActionResolution;
}

export interface MacroActionHandler {
  readonly kind: MacroActionKind;
  compile(
    action: KnownMacroAction,
    context: ActionContext,
  ): ActionResolution | null;
}

export function defineMacroAction<TKind extends MacroActionKind>(
  definition: ActionDefinition<TKind>,
): MacroActionHandler {
  const handles = (action: KnownMacroAction): action is MacroActionOf<TKind> =>
    action.kind === definition.kind;
  return {
    kind: definition.kind,
    compile: (action, context) =>
      handles(action) ? definition.compile(action, context) : null,
  };
}

/** Action handlers are selected by kind; fixture registries can omit any kind explicitly. */
export class MacroActionRegistry {
  private readonly handlers: ReadonlyMap<string, MacroActionHandler>;

  constructor(handlers: readonly MacroActionHandler[]) {
    const entries = new Map<string, MacroActionHandler>();
    for (const handler of handlers) {
      if (entries.has(handler.kind)) {
        throw new Error(`Two macro handlers implement ${handler.kind}`);
      }
      entries.set(handler.kind, handler);
    }
    this.handlers = entries;
  }

  compile(
    action: KnownMacroAction,
    context: ActionContext,
  ): ActionResolution | null {
    return this.handlers.get(action.kind)?.compile(action, context) ?? null;
  }
}
