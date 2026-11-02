import {describe, expect, it} from 'vitest';
import {
  parseBackUpNowRequest,
  parseBackUpNowResult,
  parseChooseLocationRequest,
  parseChooseLocationResult,
  parseLocationsView,
} from '@core/schema/libraryLocations';

const row = {path: String.raw`C:\data\Songs`, pending: false};
const view = {
  songs: row,
  media: {path: String.raw`C:\data\Media`, pending: true},
  backup: {path: String.raw`C:\data\Backups`, pending: false},
  lastBackup: 1_700_000_000_000,
  backingUp: false,
};

describe('the folder request', () => {
  it.each(['songsPath', 'mediaPath', 'backupPath'])('accepts %s', field => {
    expect(parseChooseLocationRequest({field})).toEqual({
      ok: true,
      value: {field},
    });
  });

  it.each([undefined, null, [], {}, {field: 'dataRoot'}, {field: 1}])(
    'refuses %j',
    value => {
      expect(parseChooseLocationRequest(value).ok).toBe(false);
    },
  );
});

describe('the locations view', () => {
  it('accepts the folders with and without a last backup', () => {
    expect(parseLocationsView(view).ok).toBe(true);
    expect(parseLocationsView({...view, lastBackup: null}).ok).toBe(true);
  });

  it.each([
    ['a missing row', {...view, songs: undefined}],
    ['a row with no pending flag', {...view, media: {path: 'C:\\data'}}],
    ['a fractional time', {...view, lastBackup: 1.5}],
    ['a negative time', {...view, lastBackup: -1}],
    ['a backing-up flag that is text', {...view, backingUp: 'yes'}],
  ])('refuses %s', (_name, value) => {
    expect(parseLocationsView(value).ok).toBe(false);
  });
});

describe('the answers', () => {
  it('accepts a stored folder and every refusal', () => {
    expect(parseChooseLocationResult({ok: true}).ok).toBe(true);
    for (const reason of [
      'canceled',
      'not-writable',
      'outside-development',
      'overlaps-backup',
      'settings-locked',
    ]) {
      expect(parseChooseLocationResult({ok: false, error: {reason}}).ok).toBe(
        true,
      );
    }
  });

  it('keeps the system words of a folder that is not writable', () => {
    expect(
      parseChooseLocationResult({
        ok: false,
        error: {reason: 'not-writable', detail: 'EACCES'},
      }),
    ).toEqual({
      ok: true,
      value: {ok: false, error: {reason: 'not-writable', detail: 'EACCES'}},
    });
  });

  it.each([
    {ok: false, error: {reason: 'gone'}},
    {ok: false},
    {ok: false, error: {reason: 'not-writable', detail: 'x'.repeat(501)}},
    null,
  ])('refuses the folder answer %j', value => {
    expect(parseChooseLocationResult(value).ok).toBe(false);
  });

  it('accepts a finished backup and each reason it did not run', () => {
    expect(parseBackUpNowResult({ok: true}).ok).toBe(true);
    for (const reason of ['running', 'output-on', 'failed']) {
      expect(parseBackUpNowResult({ok: false, error: {reason}}).ok).toBe(true);
    }
    expect(parseBackUpNowResult({ok: false, error: {reason: 'later'}}).ok).toBe(
      false,
    );
  });

  it('sends the backup request as null only', () => {
    expect(parseBackUpNowRequest(null).ok).toBe(true);
    expect(parseBackUpNowRequest({}).ok).toBe(false);
    expect(parseBackUpNowRequest(undefined).ok).toBe(false);
  });
});
