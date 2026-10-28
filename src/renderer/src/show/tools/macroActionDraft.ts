import {
  parseKnownMacroAction,
  type KnownMacroAction,
  type MacroActionKind,
} from '@shared/schema/macros';

export interface MacroActionDraft {
  readonly kind: MacroActionKind;
  readonly target?: string | undefined;
  readonly screen?: string | undefined;
  readonly operation?: string | undefined;
  readonly clearTarget?: 'layer' | 'prop' | undefined;
  readonly values?: Readonly<Record<string, string>> | undefined;
  readonly targets?: readonly string[] | 'all' | undefined;
  readonly duration?: number | null | undefined;
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
      value = {kind: draft.kind};
      break;
    case 'clearLayer':
      value =
        draft.clearTarget === 'prop'
          ? {kind: draft.kind, prop: target}
          : {kind: draft.kind, layer: target};
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
