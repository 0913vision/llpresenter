import {prepareMacroAction, type MacroActionDraft} from '@core/macros';
import {parseMacroId} from '@core/schema/common/ids';
import type {
  KnownMacroAction,
  Macro,
  MacroActionKind,
  MacroCollection,
} from '@core/schema/tools/macros';
import type {MacroEdit} from '../macroEdits';
import type {MacroMenuHandlers} from './macroMenuEntries';
import type {ShowTool} from '../../showTools';

/** Captures the macro and action snapshot used by the active editor. */
export type MacroEditor =
  | {kind: 'color'; item: Macro; anchor: HTMLElement}
  | {kind: 'icon'; item: Macro}
  | {kind: 'new-collection'; item: Macro}
  | {
      kind: 'action';
      item: Macro;
      actionKind: MacroActionKind;
      index?: number | undefined;
      initial?: MacroActionDraft | undefined;
    }
  | {kind: 'rename'; item: Macro};

/** Where 열기 of an action goes: 화면 설정, or the tool that holds it. */
export type MacroActionPlace =
  {readonly kind: 'screens'} | {readonly kind: 'tool'; readonly tool: ShowTool};

/**
 * Where 열기 of a 동작 goes: the 화면 settings or a tool of 진행, or null when it has
 * no place to open.
 */
export function macroActionPlace(
  action: KnownMacroAction,
): MacroActionPlace | null {
  switch (action.kind) {
    case 'theme':
      return {kind: 'screens'};
    case 'timer':
    case 'prop':
    case 'message':
    case 'audio':
    case 'macro':
      return {kind: 'tool', tool: action.kind};
    case 'audioPlaylist':
      return {kind: 'tool', tool: 'audio'};
    case 'clearAll':
    case 'clearLayer':
    case 'media':
      return null;
  }
}

/** What the menu of one macro needs from the panel. */
export interface MacroMenuContext {
  readonly start: (item: Macro) => void;
  /** Opens 이름 바꾸기 once the menu has closed. */
  readonly rename: (item: Macro) => void;
  readonly edit: (editor: MacroEditor) => void;
  /** The tile the menu opened from, which the color picker points at. */
  readonly trigger: HTMLElement | undefined;
  /** The 모음 the tab shows; undefined for 모든 매크로. */
  readonly shown: MacroCollection['id'] | undefined;
  readonly commit: (edit: MacroEdit) => void;
  /** Removes one action, or all of them with `null`. */
  readonly removeActions: (item: Macro, index: number | null) => void;
  readonly remove: (item: Macro) => void;
  readonly openPalette: (id: Macro['id']) => void;
  readonly open: (place: MacroActionPlace) => void;
}

/** The commands of the menu of one macro. */
export function macroMenuHandlers(
  item: Macro,
  context: MacroMenuContext,
): MacroMenuHandlers {
  const {commit, edit} = context;
  return {
    start: () => context.start(item),
    rename: () => context.rename(item),
    changeIcon: () => edit({kind: 'icon', item}),
    changeColor: () => {
      if (context.trigger) {
        edit({kind: 'color', item, anchor: context.trigger});
      }
    },
    toggleStartup: () =>
      commit({
        kind: 'update',
        id: item.id,
        changes: {runOnStartup: item.runOnStartup !== true},
      }),
    addTo: collection =>
      commit({kind: 'membership', id: item.id, collection, member: true}),
    moveTo: collection => {
      if (context.shown === undefined) return;
      commit({kind: 'move', id: item.id, from: context.shown, to: collection});
    },
    newCollection: () => edit({kind: 'new-collection', item}),
    addAction: actionKind => edit({kind: 'action', item, actionKind}),
    chooseAction: (draft, index) => {
      if (draft.kind === 'message') {
        edit({
          kind: 'action',
          item,
          actionKind: draft.kind,
          index,
          initial: draft,
        });
        return;
      }
      const action = prepareMacroAction(draft);
      if (action) {
        commit({
          kind: 'action',
          id: item.id,
          action:
            index === undefined
              ? {kind: 'append', action}
              : {kind: 'replace', index, action, expected: item.actions},
        });
      }
    },
    openAction: action => {
      const place = macroActionPlace(action);
      if (place !== null) context.open(place);
    },
    removeAllActions: () => context.removeActions(item, null),
    openPalette: () => context.openPalette(item.id),
    removeAction: index => context.removeActions(item, index),
    duplicate: () => {
      const copyId = parseMacroId(crypto.randomUUID());
      if (copyId.ok) {
        commit({kind: 'duplicate', id: item.id, copyId: copyId.value});
      }
    },
    remove: () => context.remove(item),
  };
}
