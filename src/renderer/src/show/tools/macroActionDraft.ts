import type {ClearFade} from '@core/schema/clearFade';
import {
  parseKnownMacroAction,
  type KnownMacroAction,
  type MacroActionKind,
} from '@core/schema/macros';

export interface MacroActionDraft {
  readonly kind: MacroActionKind;
  readonly target?: string | undefined;
  readonly screen?: string | undefined;
  readonly operation?: string | undefined;
  readonly clearTarget?: 'layer' | 'prop' | undefined;
  readonly values?: Readonly<Record<string, string>> | undefined;
  readonly targets?: readonly string[] | 'all' | undefined;
  readonly duration?: number | null | undefined;
  readonly transition?: ClearFade | undefined;
}

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
  const target = draft.target;
  let value: unknown;
  switch (draft.kind) {
    case 'look':
      value = {kind: draft.kind, look: target};
      break;
    case 'stageLayout':
      value = {
        kind: draft.kind,
        layout: target,
        ...(draft.screen ? {screen: draft.screen} : {}),
      };
      break;
    case 'clearAll':
      value = {
        kind: draft.kind,
        ...(draft.transition ? {transition: draft.transition} : {}),
      };
      break;
    case 'clearLayer':
      value =
        draft.clearTarget === 'prop'
          ? {
              kind: draft.kind,
              prop: target,
              ...(draft.transition ? {transition: draft.transition} : {}),
            }
          : {
              kind: draft.kind,
              layer: target,
              ...(draft.transition ? {transition: draft.transition} : {}),
            };
      break;
    case 'media':
      value = {kind: draft.kind, media: target};
      break;
    case 'prop':
      value = {kind: draft.kind, prop: target, mode: draft.operation ?? 'on'};
      break;
    case 'message':
      value = {
        kind: draft.kind,
        template: target,
        values: draft.values ?? {},
        targets: draft.targets ?? 'all',
        duration: draft.duration ?? null,
      };
      break;
    case 'notice':
      value = {kind: draft.kind, notice: target};
      break;
    case 'audio':
      value =
        draft.operation === 'fadeOut' || draft.operation === 'stop'
          ? {kind: draft.kind, operation: draft.operation}
          : {
              kind: draft.kind,
              operation: draft.operation ?? 'play',
              media: target,
            };
      break;
    case 'audioPlaylist':
      value = {kind: draft.kind, playlist: target};
      break;
    case 'timer':
      value = {
        kind: draft.kind,
        timer: target,
        operation: draft.operation ?? 'start',
      };
      break;
    case 'macro':
      value = {kind: draft.kind, macro: target};
      break;
  }
  const parsed = parseKnownMacroAction(value);
  return parsed.ok ? parsed.value : undefined;
}

export function draftMacroAction(action: KnownMacroAction): MacroActionDraft {
  switch (action.kind) {
    case 'look':
      return {kind: action.kind, target: action.look};
    case 'stageLayout':
      return {kind: action.kind, target: action.layout, screen: action.screen};
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
    case 'notice':
      return {kind: action.kind, target: action.notice};
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
