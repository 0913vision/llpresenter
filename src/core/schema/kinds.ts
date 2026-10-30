import * as v from 'valibot';
import {isRecord} from '../common/guards';
import {jsonObject, nonBlankText} from './primitives';

/**
 * A schema for objects told apart by their `kind` value. It picks the schema
 * of that kind, so that issues point at the right field. An object of a kind
 * this version doesn't know is kept unchanged, with only `kind` and the shared
 * fields typed.
 *
 * @param kinds - The known kinds, which are also the keys of `schemas`.
 * @param sharedEntries - The fields every kind has, which an object of an
 *   unknown kind must have too.
 */
export function kindsWithUnknown<
  TKind extends string,
  TSchemas extends Readonly<Record<TKind, v.GenericSchema>>,
  TEntries extends v.ObjectEntries,
>(kinds: readonly TKind[], schemas: TSchemas, sharedEntries: TEntries) {
  const unknownKindSchema = jsonObject({
    ...sharedEntries,
    kind: v.pipe(nonBlankText, v.notValues(kinds)),
  });
  return v.lazy(
    (input: unknown): TSchemas[TKind] | typeof unknownKindSchema => {
      const kind = kinds.find(
        known => isRecord(input) && input['kind'] === known,
      );
      return kind === undefined ? unknownKindSchema : schemas[kind];
    },
  );
}

/** Whether `kind` is one of `kinds`. */
export function isKnownKind(kinds: readonly string[], kind: string): boolean {
  return kinds.includes(kind);
}
