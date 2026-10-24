import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {isRecord} from '../guards';
import {parseFile, serializeFile, type FileFormat} from './fileFormat';
import type {MigrationStep} from './migration';
import {jsonObject, positiveInteger} from './primitives';
import {expectFailure, expectSuccess, TestRandom} from './testHelpers';

const FILE = 'notes/note.json';
// NOTE(0913vision): 200,000 entries are past the engine's argument limit for a
// spread. Reading and writing them takes about two seconds, so the wide test
// gets more time than the default.
const WIDE_COUNT = 200_000;
const WIDE_TEST_TIMEOUT_MS = 30_000;
const RANDOM_TEXTS = 500;

const noteSchema = jsonObject({
  format: v.literal('llnote'),
  schemaVersion: positiveInteger,
  text: v.string(),
  meta: v.exactOptional(jsonObject({author: v.string()})),
});

const renameBodyToText: MigrationStep = ({body, ...rest}) => ({
  ...rest,
  text: body,
});

const noteFormat: FileFormat<typeof noteSchema> = {
  format: 'llnote',
  schema: noteSchema,
  migrations: [renameBodyToText],
};

function parseNote(json: unknown) {
  return parseFile(noteFormat, JSON.stringify(json), FILE);
}

describe('parseFile', () => {
  it('reads a current file as editable', () => {
    const loaded = expectSuccess(
      parseNote({format: 'llnote', schemaVersion: 2, text: 'hi'}),
    );

    expect(loaded).toEqual({
      data: {format: 'llnote', schemaVersion: 2, text: 'hi'},
      access: 'editable',
      sourceVersion: 2,
      dropped: [],
    });
  });

  it('keeps unknown fields at the top and in nested objects', () => {
    const loaded = expectSuccess(
      parseNote({
        format: 'llnote',
        schemaVersion: 2,
        future: [1, 2],
        text: 'hi',
        meta: {author: 'a', color: 'teal'},
      }),
    );

    expect(loaded.data).toEqual({
      format: 'llnote',
      schemaVersion: 2,
      text: 'hi',
      meta: {author: 'a', color: 'teal'},
      future: [1, 2],
    });
  });

  it('keeps unknown keys named __proto__, prototype, and constructor', () => {
    const text =
      '{"format":"llnote","schemaVersion":2,"__proto__":{"x":1},' +
      '"text":"hi","prototype":2,' +
      '"meta":{"author":"a","constructor":3,"__proto__":{"y":2}}}';

    const loaded = expectSuccess(parseFile(noteFormat, text, FILE));
    const written = expectSuccess(serializeFile(noteFormat, loaded.data, FILE));

    const knownFirst: unknown = JSON.parse(
      '{"format":"llnote","schemaVersion":2,"text":"hi",' +
        '"meta":{"author":"a","constructor":3,"__proto__":{"y":2}},' +
        '"__proto__":{"x":1},"prototype":2}',
    );
    expect(written).toBe(`${JSON.stringify(knownFirst, null, 2)}
`);
    expect(Object.getPrototypeOf(loaded.data)).toBe(Object.prototype);
  });

  it.each([
    ['the root', '[]', 'format'],
    [
      'a nested object',
      '{"format":"llnote","schemaVersion":2,"text":"hi","meta":[]}',
      'meta',
    ],
  ])('rejects an array as %s', (_name, text, kind) => {
    const error = expectFailure(parseFile(noteFormat, text, FILE));

    expect(error.kind === 'format' ? 'format' : error.field).toBe(kind);
  });

  it('migrates an older file and reports the version it had', () => {
    const loaded = expectSuccess(
      parseNote({format: 'llnote', schemaVersion: 1, body: 'hi', extra: 1}),
    );

    expect(loaded).toEqual({
      data: {format: 'llnote', schemaVersion: 2, text: 'hi', extra: 1},
      access: 'editable',
      sourceVersion: 1,
      dropped: [],
    });
  });

  it('opens a newer file read-only when it still fits the schema', () => {
    const loaded = expectSuccess(
      parseNote({format: 'llnote', schemaVersion: 3, text: 'hi', added: true}),
    );

    expect(loaded.access).toBe('readOnly');
    expect(loaded.sourceVersion).toBe(3);
    expect(loaded.data).toEqual({
      format: 'llnote',
      schemaVersion: 3,
      text: 'hi',
      added: true,
    });
  });

  it('reports a newer file that no longer fits the schema as newer', () => {
    const error = expectFailure(
      parseNote({format: 'llnote', schemaVersion: 3, content: 'hi'}),
    );

    expect(error).toMatchObject({kind: 'newer', file: FILE, field: 'text'});
  });

  it('reports text that is not JSON', () => {
    const error = expectFailure(parseFile(noteFormat, '{"format": ', FILE));

    expect(error).toMatchObject({kind: 'json', file: FILE, field: ''});
  });

  it('accepts a byte order mark before the JSON', () => {
    const text = `\uFEFF${JSON.stringify({format: 'llnote', schemaVersion: 2, text: 'hi'})}`;

    expect(expectSuccess(parseFile(noteFormat, text, FILE)).data.text).toBe(
      'hi',
    );
  });

  it.each([
    ['an array', []],
    ['a string', 'llnote'],
    ['null', null],
    ['no format', {schemaVersion: 2, text: 'hi'}],
    ['another format', {format: 'llsong', schemaVersion: 2, text: 'hi'}],
  ])('reports %s as another format', (_name, json) => {
    expect(expectFailure(parseNote(json)).kind).toBe('format');
  });

  it.each([
    ['missing', {format: 'llnote', text: 'hi'}],
    ['zero', {format: 'llnote', schemaVersion: 0, text: 'hi'}],
    ['a fraction', {format: 'llnote', schemaVersion: 1.5, text: 'hi'}],
    ['a string', {format: 'llnote', schemaVersion: '2', text: 'hi'}],
  ])('reports a schemaVersion that is %s', (_name, json) => {
    expect(expectFailure(parseNote(json))).toMatchObject({
      kind: 'invalid',
      field: 'schemaVersion',
    });
  });

  it('reports the path of the first invalid field', () => {
    const error = expectFailure(
      parseNote({
        format: 'llnote',
        schemaVersion: 2,
        text: 'hi',
        meta: {author: 7},
      }),
    );

    expect(error).toMatchObject({kind: 'invalid', field: 'meta.author'});
    expect(error.message).toContain('7');
  });

  it('reports a migration step that throws', () => {
    const failingFormat: FileFormat<typeof noteSchema> = {
      ...noteFormat,
      migrations: [
        () => {
          throw new Error('step failed');
        },
      ],
    };

    const error = expectFailure(
      parseFile(
        failingFormat,
        JSON.stringify({format: 'llnote', schemaVersion: 1, body: 'hi'}),
        FILE,
      ),
    );

    expect(error).toEqual({
      kind: 'migration',
      file: FILE,
      field: '',
      message: 'step failed',
    });
  });

  it(
    'reads and writes very wide unknown arrays and objects',
    () => {
      const count = WIDE_COUNT;
      const wideObject = Object.fromEntries(
        Array.from({length: count}, (_, index) => [`key${index}`, index]),
      );
      const text = JSON.stringify({
        format: 'llnote',
        schemaVersion: 2,
        text: 'hi',
        list: Array.from({length: count}, (_, index) => index),
        wideObject,
      });

      const loaded = expectSuccess(parseFile(noteFormat, text, FILE));
      const written = expectSuccess(
        serializeFile(noteFormat, loaded.data, FILE),
      );

      const reread: unknown = JSON.parse(written);
      const original: unknown = JSON.parse(text);
      expect(reread).toEqual(original);
    },
    WIDE_TEST_TIMEOUT_MS,
  );

  it.each([
    ['nested deeper than the limit', 1_000],
    ['nested deeper than the stack', 200_000],
  ])('reports unknown JSON %s as a file error', (_name, depth) => {
    const text =
      '{"format":"llnote","schemaVersion":2,"text":"hi","deep":' +
      `${'['.repeat(depth)}${']'.repeat(depth)}}`;

    expect(() => parseFile(noteFormat, text, FILE)).not.toThrow();
    expect(expectFailure(parseFile(noteFormat, text, FILE)).file).toBe(FILE);
  });

  it('never throws, whatever the text is', () => {
    const random = new TestRandom(7);
    const pieces = ['{', '}', '[', ']', '"', ':', ',', 'format', 'llnote', '1'];
    for (let run = 0; run < RANDOM_TEXTS; run++) {
      const text = Array.from({length: random.integer(0, 12)}, () =>
        random.pick(['', ...pieces]),
      ).join('');

      expect(() => parseFile(noteFormat, text, FILE)).not.toThrow();
    }
  });
});

describe('serializeFile', () => {
  const note = {format: 'llnote', schemaVersion: 2, text: 'hi'} as const;

  it('writes two-space JSON with LF and a final newline', () => {
    const text = expectSuccess(serializeFile(noteFormat, note, FILE));

    expect(text).toBe(
      '{\n  "format": "llnote",\n  "schemaVersion": 2,\n  "text": "hi"\n}\n',
    );
  });

  it('writes known fields in schema order, then unknown fields as given', () => {
    const shuffled = {zeta: 1, text: 'hi', alpha: 2, schemaVersion: 2};

    const text = expectSuccess(
      serializeFile(noteFormat, {...shuffled, format: 'llnote'}, FILE),
    );

    const written: unknown = JSON.parse(text);
    expect(isRecord(written) ? Object.keys(written) : []).toEqual([
      'format',
      'schemaVersion',
      'text',
      'zeta',
      'alpha',
    ]);
  });

  it('reads back what it wrote, unknown fields included', () => {
    const data = {...note, meta: {author: 'a', color: 'teal'}, future: 1};

    const text = expectSuccess(serializeFile(noteFormat, data, FILE));

    expect(expectSuccess(parseFile(noteFormat, text, FILE)).data).toEqual(data);
  });

  it('does not change the data it was given', () => {
    const data = {schemaVersion: 2, text: 'hi', format: 'llnote', extra: 1};
    const copy = structuredClone(data);

    serializeFile(noteFormat, data, FILE);

    expect(data).toEqual(copy);
  });

  it('refuses data that breaks the schema', () => {
    const error = expectFailure(
      serializeFile(noteFormat, {...note, text: 3}, FILE),
    );

    expect(error).toMatchObject({kind: 'invalid', file: FILE, field: 'text'});
  });

  it('refuses a newer file, which is read-only', () => {
    const error = expectFailure(
      serializeFile(noteFormat, {...note, schemaVersion: 3}, FILE),
    );

    expect(error).toMatchObject({kind: 'newer', field: 'schemaVersion'});
  });

  it('refuses an older version, which must be migrated first', () => {
    const error = expectFailure(
      serializeFile(noteFormat, {...note, schemaVersion: 1}, FILE),
    );

    expect(error).toMatchObject({kind: 'invalid', field: 'schemaVersion'});
  });

  it('refuses data without a schemaVersion even if the schema omits it', () => {
    const looseFormat: FileFormat<v.GenericSchema> = {
      format: 'llnote',
      schema: v.looseObject({format: v.literal('llnote')}),
      migrations: [],
    };

    const error = expectFailure(
      serializeFile(looseFormat, {format: 'llnote'}, FILE),
    );

    expect(error).toMatchObject({kind: 'invalid', field: 'schemaVersion'});
  });

  it('refuses data that refers to itself instead of throwing', () => {
    const cyclic: Record<string, unknown> = {...note};
    cyclic['self'] = cyclic;

    const error = expectFailure(serializeFile(noteFormat, cyclic, FILE));

    expect(error).toMatchObject({kind: 'invalid', file: FILE});
  });

  it('reports a schema callback that throws as a file error', () => {
    const throwingFormat: FileFormat<v.GenericSchema> = {
      ...noteFormat,
      schema: v.pipe(
        noteSchema,
        v.check(() => {
          throw new Error('callback failed');
        }),
      ),
    };
    const text = JSON.stringify(note);

    expect(expectFailure(parseFile(throwingFormat, text, FILE))).toEqual({
      kind: 'invalid',
      file: FILE,
      field: '',
      message: 'callback failed',
    });
    expect(expectFailure(serializeFile(throwingFormat, note, FILE))).toEqual({
      kind: 'invalid',
      file: FILE,
      field: '',
      message: 'callback failed',
    });
  });

  it('refuses unknown fields that JSON cannot hold', () => {
    const error = expectFailure(
      serializeFile(noteFormat, {...note, size: 1n}, FILE),
    );

    expect(error.kind).toBe('invalid');
  });
});
