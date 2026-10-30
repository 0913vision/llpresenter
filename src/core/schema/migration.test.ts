import {describe, expect, it} from 'vitest';
import {currentVersion, migrate, type MigrationStep} from './migration';

const renameBodyToText: MigrationStep = ({body, ...rest}) => ({
  ...rest,
  text: body,
});

const addTags: MigrationStep = file => ({...file, tags: []});

describe('currentVersion', () => {
  it('is 1 without steps and grows by one per step', () => {
    expect(currentVersion([])).toBe(1);
    expect(currentVersion([renameBodyToText])).toBe(2);
    expect(currentVersion([renameBodyToText, addTags])).toBe(3);
  });
});

describe('migrate', () => {
  it('runs every step from version 1 in order and sets schemaVersion', () => {
    const migrated = migrate(
      {format: 'llnote', schemaVersion: 1, body: 'hi'},
      1,
      [renameBodyToText, addTags],
    );

    expect(migrated).toEqual({
      format: 'llnote',
      schemaVersion: 3,
      text: 'hi',
      tags: [],
    });
  });

  it('starts at the step after the file version', () => {
    const migrated = migrate(
      {format: 'llnote', schemaVersion: 2, text: 'hi'},
      2,
      [renameBodyToText, addTags],
    );

    expect(migrated).toEqual({
      format: 'llnote',
      schemaVersion: 3,
      text: 'hi',
      tags: [],
    });
  });

  it('keeps fields the steps do not know', () => {
    const migrated = migrate(
      {schemaVersion: 1, body: 'hi', future: {score: true}},
      1,
      [renameBodyToText],
    );

    expect(migrated).toEqual({
      schemaVersion: 2,
      text: 'hi',
      future: {score: true},
    });
  });

  it('returns the file unchanged when it is already current', () => {
    const file = {schemaVersion: 2, text: 'hi'};

    expect(migrate(file, 2, [renameBodyToText])).toBe(file);
  });

  it('does not change the object it was given', () => {
    const file = {schemaVersion: 1, body: 'hi'};

    migrate(file, 1, [renameBodyToText]);

    expect(file).toEqual({schemaVersion: 1, body: 'hi'});
  });
});
