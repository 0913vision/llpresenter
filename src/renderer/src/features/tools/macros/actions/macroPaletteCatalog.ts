import {
  macroActionKinds,
  type MacroActionKind,
} from '@core/schema/tools/macros';
import {MACRO_PALETTE_GROUPS} from '@renderer/platform/macroActionDescriptor';
import {MACRO_ACTIONS} from './macroActionCatalog';

/** The drag type of a 동작 kind dragged from the palette. */
export const MACRO_ACTION_MIME = 'application/x-llpresenter-macro-action';

/** One 동작 kind of the palette, with its name. */
export interface PaletteAction {
  readonly kind: MacroActionKind;
  readonly label: string;
}
/** A titled group of 동작 kinds in the palette. */
export interface PaletteGroup {
  readonly label: string;
  readonly actions: readonly PaletteAction[];
}

// NOTE(0913vision): 테마 leads the palette; the other kinds keep the order of
// the schema, so a new kind shows without another list to update.
const PALETTE_ORDER: readonly MacroActionKind[] = [
  'theme',
  ...macroActionKinds.filter(kind => kind !== 'theme'),
];

/** Every 동작 kind in its group, 테마 first. */
export const MACRO_PALETTE: readonly PaletteGroup[] = MACRO_PALETTE_GROUPS.map(
  label => ({
    label,
    actions: PALETTE_ORDER.filter(
      kind => MACRO_ACTIONS[kind].paletteGroup === label,
    ).map(kind => ({kind, label: MACRO_ACTIONS[kind].label})),
  }),
);

/** The 동작 kind that a dragged value names, or undefined when it names none. */
export function readMacroActionDrag(
  value: string,
): MacroActionKind | undefined {
  return macroActionKinds.find(kind => kind === value);
}

/**
 * The groups of the palette with only the kinds whose names contain `query`;
 * all of them for a blank query.
 */
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
