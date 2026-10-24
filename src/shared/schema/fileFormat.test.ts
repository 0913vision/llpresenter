import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {parseFile, serializeFile, type FileFormat} from './fileFormat';
import type {MigrationStep} from './migration';
import {positiveInteger} from './primitives';
import {expectFailure, expectSuccess, TestRandom} from './testHelpers';

const FILE = 'notes/note.json';
const RANDOM_TEXTS = 500;

const noteSchema = v.looseObject({
  format: v.literal('llnote'),
  schemaVersion: positiveInteger,
  text: v.string(),
  meta: v.exactOptional(v.looseObject({author: v.string()})),
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

  it('migrates an older file and reports the version it had', () => {
    const loaded = expectSuccess(
      parseNote({format: 'llnote', schemaVersion: 1, body: 'hi', extra: 1}),
    );

    expect(loaded).toEqual({
      data: {format: 'llnote', schemaVersion: 2, text: 'hi', extra: 1},
      access: 'editable',
      sourceVersion: 1,
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
    const text = `﻿${JSON.stringify({format: 'llnote', schemaVersion: 2, text: 'hi'})}`;

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

    expect(Object.keys(JSON.parse(text))).toEqual([
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

  it('refuses unknown fields that JSON cannot hold', () => {
    const error = expectFailure(
      serializeFile(noteFormat, {...note, size: 1n}, FILE),
    );

    expect(error.kind).toBe('invalid');
  });
});
