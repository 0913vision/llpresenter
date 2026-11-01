import {macroActionKinds, type MacroActionKind} from '@core/schema/macros';
import {MACRO_PALETTE_GROUPS} from '@renderer/platform/macroActionDescriptor';
import {MACRO_ACTIONS} from './macroActionCatalog';

export const MACRO_ACTION_MIME = 'application/x-llpresenter-macro-action';

export interface PaletteAction {
  readonly kind: MacroActionKind;
  readonly label: string;
}
export interface PaletteGroup {
  readonly label: string;
  readonly actions: readonly PaletteAction[];
}

const PALETTE_ORDER: readonly MacroActionKind[] = [
  'theme',
  'clearAll',
  'clearLayer',
  'media',
  'prop',
  'message',
  'notice',
  'audio',
  'audioPlaylist',
  'timer',
  'macro',
];

export const MACRO_PALETTE: readonly PaletteGroup[] = MACRO_PALETTE_GROUPS.map(
  label => ({
    label,
    actions: PALETTE_ORDER.filter(
      kind => MACRO_ACTIONS[kind].paletteGroup === label,
    ).map(kind => ({kind, label: MACRO_ACTIONS[kind].label})),
  }),
);

export function readMacroActionDrag(
  value: string,
): MacroActionKind | undefined {
  return macroActionKinds.find(kind => kind === value);
}

export function searchMacroPalette(query: string): readonly PaletteGroup[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return MACRO_PALETTE;
  return MACRO_PALETTE.flatMap(group => {
    const actions = group.actions.filter(action =>
      action.label.toLocaleLowerCase().includes(search),
    );
    return actions.length ? [{...group, actions}] : [];
  });
}
