import {freeName} from '@core/common/freeName';
import {parseMacroCollectionId, parseMacroId} from '@core/schema/common/ids';
import type {Macro, MacroCollection} from '@core/schema/tools/macros';

/** A macro that is being created, with the collection it goes into. */
export type CreatingMacro = Macro & {
  readonly collection?: MacroCollection['id'] | undefined;
};

/**
 * The collections as the panel shows them: each with the macros still being
 * created in it added after its own, so a new macro shows in its collection
 * before the file is written.
 */
export function withCreatingMacros(
  collections: readonly MacroCollection[],
  creating: readonly CreatingMacro[],
): MacroCollection[] {
  return collections.map(group => ({
    ...group,
    macroIds: [
      ...group.macroIds,
      ...creating
        .filter(
          item =>
            item.collection === group.id && !group.macroIds.includes(item.id),
        )
        .map(item => item.id),
    ],
  }));
}

/**
 * A new, empty macro named 새 매크로, numbered past the names there are, or
 * null when no id could be made.
 */
export function newMacro(id: string, names: ReadonlySet<string>): Macro | null {
  const parsed = parseMacroId(id);
  if (!parsed.ok) return null;
  return {
    id: parsed.value,
    name: freeName('새 매크로', names),
    icon: 'macro',
    color: 'teal',
    actions: [],
  };
}

/**
 * A new, empty collection named 새 모음, numbered past the names there are, or
 * null when no id could be made.
 */
export function newCollection(
  id: string,
  names: ReadonlySet<string>,
): MacroCollection | null {
  const parsed = parseMacroCollectionId(id);
  if (!parsed.ok) return null;
  return {id: parsed.value, name: freeName('새 모음', names), macroIds: []};
}
