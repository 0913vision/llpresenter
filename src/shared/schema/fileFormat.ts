import * as v from 'valibot';
import type {Result} from '../result';
import {currentVersion, migrate, type MigrationStep} from './migration';
import {positiveInteger} from './primitives';

/**
 * Why a file couldn't be read or written. `json`: the text isn't JSON.
 * `format`: the file isn't of the expected kind. `invalid`: a field breaks the
 * schema. `newer`: a newer app version wrote the file and its content doesn't
 * fit this version. `migration`: converting an older version failed.
 */
export type FileErrorKind =
  'json' | 'format' | 'invalid' | 'newer' | 'migration';

export interface FileError {
  readonly kind: FileErrorKind;
  readonly file: string;
  /** Dot path of the failing field, such as `slides.0.lines`, or `''`. */
  readonly field: string;
  readonly message: string;
}

/** A file from a newer app version opens read-only. */
export type FileAccess = 'editable' | 'readOnly';

export interface LoadedFile<T> {
  readonly data: T;
  readonly access: FileAccess;
  /**
   * The `schemaVersion` on disk. When it is lower than the current version, the
   * data was migrated in memory and the store keeps the old file as a recovery
   * copy before the first write.
   */
  readonly sourceVersion: number;
}

/**
 * The known fields of parsed data, read-only at every level. Unknown fields
 * stay on the objects at runtime, so spreading an object keeps them, but they
 * don't show in the type.
 */
export type ReadonlyKnown<T> = T extends
  string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? ReadonlyArray<ReadonlyKnown<Item>>
    : {
        readonly [
          Key in keyof T as string extends Key ? never : Key
        ]: ReadonlyKnown<T[Key]>;
      };

export interface FileFormat<TSchema extends v.GenericSchema> {
  /** The value of the `format` field. */
  readonly format: string;
  /** The schema of the current version. Every object in it is loose. */
  readonly schema: TSchema;
  readonly migrations: readonly MigrationStep[];
}

type Problem = Omit<FileError, 'file'>;

interface Header {
  readonly content: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
}

const BYTE_ORDER_MARK = '\uFEFF';
const JSON_INDENT = 2;
const versionSchema = v.looseObject({schemaVersion: positiveInteger});

/**
 * Reads a file's text: JSON, then the header, then migration, then the schema.
 * Never throws.
 *
 * @param file - The file's path or name, for the error.
 */
export function parseFile<TSchema extends v.GenericSchema>(
  format: FileFormat<TSchema>,
  text: string,
  file: string,
): Result<LoadedFile<v.InferOutput<TSchema>>, FileError> {
  return withFile(load(format, text), file);
}

/**
 * Checks data against the current schema and writes it as stable JSON: known
 * fields in schema order, then unknown fields in their original order, two
 * spaces, LF, and a final newline. Never throws.
 *
 * @param file - The file's path or name, for the error.
 */
export function serializeFile<TSchema extends v.GenericSchema>(
  format: FileFormat<TSchema>,
  data: unknown,
  file: string,
): Result<string, FileError> {
  return withFile(write(format, data), file);
}

function load<TSchema extends v.GenericSchema>(
  format: FileFormat<TSchema>,
  text: string,
): Result<LoadedFile<v.InferOutput<TSchema>>, Problem> {
  const json = parseJson(text);
  if (!json.ok) {
    return json;
  }
  const header = readHeader(json.value, format.format);
  if (!header.ok) {
    return header;
  }
  const {schemaVersion} = header.value;
  const isNewer = schemaVersion > currentVersion(format.migrations);
  const upgraded = upgrade(header.value, format.migrations);
  if (!upgraded.ok) {
    return upgraded;
  }
  const checked = check(
    format.schema,
    upgraded.value,
    isNewer ? 'newer' : 'invalid',
  );
  if (!checked.ok) {
    return checked;
  }
  return succeed({
    data: checked.value,
    access: isNewer ? 'readOnly' : 'editable',
    sourceVersion: schemaVersion,
  });
}

function write<TSchema extends v.GenericSchema>(
  format: FileFormat<TSchema>,
  data: unknown,
): Result<string, Problem> {
  const checked = check(format.schema, data, 'invalid');
  if (!checked.ok) {
    return checked;
  }
  const version = checkWritableVersion(checked.value, format.migrations);
  if (!version.ok) {
    return version;
  }
  return attempt(
    () => `${JSON.stringify(checked.value, null, JSON_INDENT)}\n`,
    'invalid',
  );
}

function parseJson(text: string): Result<unknown, Problem> {
  const withoutMark = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  return attempt((): unknown => JSON.parse(withoutMark), 'json');
}

function readHeader(json: unknown, format: string): Result<Header, Problem> {
  const formatCheck = check(
    v.looseObject({format: v.literal(format)}),
    json,
    'format',
  );
  if (!formatCheck.ok) {
    return formatCheck;
  }
  const versionCheck = check(versionSchema, formatCheck.value, 'invalid');
  if (!versionCheck.ok) {
    return versionCheck;
  }
  return succeed({
    content: versionCheck.value,
    schemaVersion: versionCheck.value.schemaVersion,
  });
}

function upgrade(
  header: Header,
  steps: readonly MigrationStep[],
): Result<Readonly<Record<string, unknown>>, Problem> {
  if (header.schemaVersion >= currentVersion(steps)) {
    return succeed(header.content);
  }
  return attempt(
    () => migrate(header.content, header.schemaVersion, steps),
    'migration',
  );
}

function checkWritableVersion(
  data: unknown,
  steps: readonly MigrationStep[],
): Result<number, Problem> {
  const checked = check(versionSchema, data, 'invalid');
  if (!checked.ok) {
    return checked;
  }
  const {schemaVersion} = checked.value;
  const expected = currentVersion(steps);
  if (schemaVersion === expected) {
    return succeed(schemaVersion);
  }
  return fail({
    kind: schemaVersion > expected ? 'newer' : 'invalid',
    field: 'schemaVersion',
    message: `Expected schemaVersion ${expected} but received ${schemaVersion}`,
  });
}

function check<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
  kind: FileErrorKind,
): Result<v.InferOutput<TSchema>, Problem> {
  const result = v.safeParse(schema, input, {abortEarly: true});
  if (result.success) {
    return succeed(result.output);
  }
  const [issue] = result.issues;
  return fail({
    kind,
    field: v.getDotPath(issue) ?? '',
    message: issue.message,
  });
}

function attempt<T>(run: () => T, kind: FileErrorKind): Result<T, Problem> {
  try {
    return succeed(run());
  } catch (error: unknown) {
    return fail({kind, field: '', message: messageOf(error)});
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withFile<T>(
  result: Result<T, Problem>,
  file: string,
): Result<T, FileError> {
  return result.ok ? result : fail({...result.error, file});
}

function succeed<T>(value: T): Result<T, never> {
  return {ok: true, value};
}

function fail<E>(error: E): Result<never, E> {
  return {ok: false, error};
}
