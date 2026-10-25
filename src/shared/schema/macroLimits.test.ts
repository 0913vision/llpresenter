import {describe, expect, it} from 'vitest';
import {MACRO_FILE_LIMITS, parseMacros} from './macros';

const uuid = (number: number): string =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const macro = (number: number, actions: readonly object[] = []) => ({
  id: uuid(number),
  name: 'Test',
  icon: 'play',
  color: 'teal',
  actions,
});
const file = (
  macros: readonly object[],
  collections: readonly object[] = [],
) => ({format: 'llsettings.macros', schemaVersion: 1, macros, collections});
const parse = (value: object) =>
  parseMacros(JSON.stringify(value), 'macros.json');

describe('macro file limits', () => {
  it('accepts the macro and action caps and refuses an extra entry', () => {
    const macros = Array.from({length: MACRO_FILE_LIMITS.macros}, (_, index) =>
      macro(index + 1),
    );
    expect(parse(file(macros)).ok).toBe(true);
    expect(parse(file([...macros, macro(1001)])).ok).toBe(false);
    const actions = Array.from({length: MACRO_FILE_LIMITS.actions}, () => ({
      kind: 'clearAll',
    }));
    expect(parse(file([macro(1, actions)])).ok).toBe(true);
    expect(parse(file([macro(1, [...actions, {kind: 'clearAll'}])])).ok).toBe(
      false,
    );
  });

  it('caps collections and each collection membership list', () => {
    const ids = Array.from(
      {length: MACRO_FILE_LIMITS.collectionItems},
      (_, index) => uuid(index + 1),
    );
    const collection = {id: uuid(1), name: 'Collection', macroIds: ids};
    const collections = Array.from(
      {length: MACRO_FILE_LIMITS.collections},
      (_, index) => ({...collection, id: uuid(index + 1)}),
    );
    expect(parse(file([], collections)).ok).toBe(true);
    expect(
      parse(file([], [...collections, {...collection, id: uuid(201)}])).ok,
    ).toBe(false);
    expect(
      parse(file([], [{...collection, macroIds: [...ids, uuid(1001)]}])).ok,
    ).toBe(false);
  });

  it('caps message values and screen targets inside an action', () => {
    const values = Object.fromEntries(
      Array.from({length: MACRO_FILE_LIMITS.parameters}, (_, index) => [
        `field${index}`,
        'value',
      ]),
    );
    const targets = Array.from(
      {length: MACRO_FILE_LIMITS.targets},
      (_, index) => uuid(index + 1),
    );
    const action = {
      kind: 'message',
      template: uuid(1),
      values,
      targets,
      duration: null,
    };
    expect(parse(file([macro(1, [action])])).ok).toBe(true);
    expect(
      parse(
        file([macro(1, [{...action, values: {...values, extra: 'value'}}])]),
      ).ok,
    ).toBe(false);
    expect(
      parse(file([macro(1, [{...action, targets: [...targets, uuid(201)]}])]))
        .ok,
    ).toBe(false);
  });
});
