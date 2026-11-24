import {describe, expect, it} from 'vitest';
import {parseMacroCollectionId, parseMacroId} from '@core/schema/common/ids';
import type {Macro, MacroCollection} from '@core/schema/tools/macros';
import {
  newCollection,
  newMacro,
  withCreatingMacros,
} from '@renderer/features/tools/macros/newMacros';

const MACRO_A = '11111111-1111-4111-8111-111111111111';
const MACRO_B = '22222222-2222-4222-8222-222222222222';
const GROUP = '33333333-3333-4333-8333-333333333333';
const OTHER_GROUP = '44444444-4444-4444-8444-444444444444';

function macroId(text: string): Macro['id'] {
  const parsed = parseMacroId(text);
  if (!parsed.ok) throw new Error(`bad macro id ${text}`);
  return parsed.value;
}

function groupId(text: string): MacroCollection['id'] {
  const parsed = parseMacroCollectionId(text);
  if (!parsed.ok) throw new Error(`bad collection id ${text}`);
  return parsed.value;
}

function macro(id: string): Macro {
  return {id: macroId(id), name: id, icon: 'macro', color: 'teal', actions: []};
}

describe('withCreatingMacros', () => {
  it('adds a macro being created after the macros of its own collection only', () => {
    const groups: MacroCollection[] = [
      {id: groupId(GROUP), name: '예배', macroIds: [macroId(MACRO_A)]},
      {id: groupId(OTHER_GROUP), name: '광고', macroIds: []},
    ];

    const shown = withCreatingMacros(groups, [
      {...macro(MACRO_B), collection: groupId(GROUP)},
    ]);

    expect(shown.map(group => group.macroIds)).toEqual([
      [MACRO_A, MACRO_B],
      [],
    ]);
  });

  it('does not list a macro twice once its collection has it', () => {
    const groups: MacroCollection[] = [
      {id: groupId(GROUP), name: '예배', macroIds: [macroId(MACRO_B)]},
    ];

    const shown = withCreatingMacros(groups, [
      {...macro(MACRO_B), collection: groupId(GROUP)},
    ]);

    expect(shown[0]?.macroIds).toEqual([MACRO_B]);
  });

  it('leaves the collections alone for a macro created outside any', () => {
    const groups: MacroCollection[] = [
      {id: groupId(GROUP), name: '예배', macroIds: []},
    ];

    expect(withCreatingMacros(groups, [macro(MACRO_B)])).toEqual(groups);
  });
});

describe('newMacro and newCollection', () => {
  it('names a new macro past the names there are, empty and teal', () => {
    expect(newMacro(MACRO_A, new Set(['새 매크로']))).toEqual({
      id: MACRO_A,
      name: '새 매크로 2',
      icon: 'macro',
      color: 'teal',
      actions: [],
    });
  });

  it('names a new collection past the names there are, with no macros', () => {
    expect(newCollection(GROUP, new Set())).toEqual({
      id: GROUP,
      name: '새 모음',
      macroIds: [],
    });
  });

  it('makes nothing from an id that is not one', () => {
    expect(newMacro('not an id', new Set())).toBeNull();
    expect(newCollection('not an id', new Set())).toBeNull();
  });
});
