import {fillMessageText} from '@core/overlays';
import type {ClearFade} from '@core/schema/live/clearFade';
import {
  parseKnownMacroAction,
  type KnownMacroAction,
  type MacroActionKind,
} from '@core/schema/tools/macros';

/**
 * The fields of the macro action form while it is edited; `kind` decides which
 * of the others count.
 */
export interface MacroActionDraft {
  readonly kind: MacroActionKind;
  readonly target?: string | undefined;
  readonly operation?: string | undefined;
  readonly clearTarget?: 'layer' | 'prop' | undefined;
  readonly values?: Readonly<Record<string, string>> | undefined;
  readonly targets?: readonly string[] | 'all' | undefined;
  readonly duration?: number | null | undefined;
  readonly transition?: ClearFade | undefined;
}

/**
 * Turns the form into a checked action, or undefined when the fields do not
 * make a valid one.
 */
export function prepareMacroAction(
  draft: MacroActionDraft,
): KnownMacroAction | undefined {
  if (
    draft.kind === 'message' &&
    Array.isArray(draft.targets) &&
    draft.targets.length === 0
  ) {
    return undefined;
  }
  const parsed = parseKnownMacroAction(actionFields(draft));
  return parsed.ok ? parsed.value : undefined;
}

/** The fields of the action the form describes, before they are checked. */
function actionFields(draft: MacroActionDraft): unknown {
  const {kind, target, operation} = draft;
  const fade = draft.transition ? {transition: draft.transition} : {};
  switch (kind) {
    case 'clearAll':
      return {kind, ...fade};
    case 'clearLayer':
      return draft.clearTarget === 'prop'
        ? {kind, prop: target, ...fade}
        : {kind, layer: target, ...fade};
    case 'media':
      return {kind, media: target};
    case 'prop':
      return {kind, prop: target, mode: operation ?? 'on'};
    case 'message':
      return {
        kind,
        template: target,
        values: draft.values ?? {},
        targets: draft.targets ?? 'all',
        duration: draft.duration ?? null,
      };
    case 'audio':
      return operation === 'fadeOut' || operation === 'stop'
        ? {kind, operation}
        : {kind, operation: operation ?? 'play', media: target};
    case 'audioPlaylist':
      return {kind, playlist: target};
    case 'timer':
      return {kind, timer: target, operation: operation ?? 'start'};
    case 'macro':
      return {kind, macro: target};
  }
}

/** What a 메시지 동작 needs beyond its own fields. */
export interface MessageContext {
  /** The text of the chosen message, or undefined when it is gone. */
  readonly text: string | undefined;
  /** How many screens there are to show it on. */
  readonly screens: number;
}

/**
 * Whether a 메시지 동작 would show anything: its message exists, every blank is
 * filled within the length limit and leaves some text, and it has a screen to
 * go to.
 */
export function messageShows(
  draft: MacroActionDraft,
  context: MessageContext,
): boolean {
  if (context.text === undefined) return false;
  if ((draft.targets ?? 'all') === 'all' && context.screens === 0) {
    return false;
  }
  try {
    return (
      fillMessageText({text: context.text}, draft.values ?? {}).trim() !== ''
    );
  } catch {
    // NOTE(0913vision): fillMessageText throws for a blank left empty or a
    // text past the limit; both mean the action is not ready.
    return false;
  }
}

/** Turns a saved action back into the fields of the form. */
export function draftMacroAction(action: KnownMacroAction): MacroActionDraft {
  switch (action.kind) {
    case 'clearAll':
      return {kind: action.kind, transition: action.transition};
    case 'clearLayer':
      return 'prop' in action
        ? {
            kind: action.kind,
            target: action.prop,
            clearTarget: 'prop',
            transition: action.transition,
          }
        : {
            kind: action.kind,
            target: action.layer,
            clearTarget: 'layer',
            transition: action.transition,
          };
    case 'media':
      return {kind: action.kind, target: action.media};
    case 'prop':
      return {kind: action.kind, target: action.prop, operation: action.mode};
    case 'message':
      return {
        kind: action.kind,
        target: action.template,
        values: action.values,
        targets: action.targets,
        duration: action.duration,
      };
    case 'audio':
      return {
        kind: action.kind,
        operation: action.operation,
        ...(action.operation === 'play' ? {target: action.media} : {}),
      };
    case 'audioPlaylist':
      return {kind: action.kind, target: action.playlist};
    case 'timer':
      return {
        kind: action.kind,
        target: action.timer,
        operation: action.operation,
      };
    case 'macro':
      return {kind: action.kind, target: action.macro};
  }
}
