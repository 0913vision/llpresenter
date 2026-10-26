import {unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseBibleLookupRequest,
  BIBLE_LOOKUP_LIMITS,
} from '@shared/schema/bibleLookup';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {defaultPreferences} from '@shared/schema/preferences';
import {makeTempDir} from '../../../test/temp-dir';
import type {SettingsReader} from '../store/settingsStore';
import {BibleLookupSession} from './lookup';
import * as library from './library';
import {parsedTranslation, translationFile} from './testFiles';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  flush: async () => undefined,
};

function document(file = 'sample.llbible') {
  const parsed = parseSettingsDocument({
    name: 'bible',
    value: {
      format: 'llsettings.bible',
      schemaVersion: 1,
      translations: [
        {id: 'sample', name: 'Invented', lang: 'ko', file, default: true},
      ],
      recents: [],
    },
    access: 'editable',
    revision: 1,
  });
  if (!parsed.ok) throw new Error('Invalid Bible settings fixture');
  return parsed.value;
}

function request(input = '요 3:16-18') {
  const parsed = parseBibleLookupRequest({input, translation: 'sample'});
  if (!parsed.ok) throw new Error('Invalid lookup fixture');
  return parsed.value;
}

async function setup() {
  const folder = await makeTempDir();
  await writeFile(
    join(folder, 'sample.llbible'),
    JSON.stringify(translationFile()),
  );
  const get = vi.fn(() => document());
  const settings: SettingsReader = {
    get,
    preferences: () => defaultPreferences,
    subscribe: () => () => undefined,
  };
  const session = new BibleLookupSession({
    folder,
    settings: Promise.resolve(settings),
    log,
  });
  onTestFinished(() => session.dispose());
  return {folder, session, get};
}

describe('Bible lookup session', () => {
  it('drops expanded suggestions past the reply limit without rejecting the lookup', async () => {
    const {session} = await setup();
    const input = `요 3:${' '.repeat(250)}16`;
    expect(input).toHaveLength(BIBLE_LOOKUP_LIMITS.input);
    const reply = await session.lookup(request(input));
    expect(reply.result).toMatchObject({
      ok: true,
      value: {ref: '요한복음 3:16'},
    });
    expect(reply.suggestions).toEqual([]);
    const boundary = await session.lookup(request(`요 3:${' '.repeat(247)}16`));
    expect(boundary.suggestions[0]?.input).toHaveLength(
      BIBLE_LOOKUP_LIMITS.input,
    );
  });
  it('resolves both grammars, preserves the input, and reads cached text after the file disappears', async () => {
    const {folder, session} = await setup();
    const first = await session.lookup(request());
    expect(first).toMatchObject({
      input: '요 3:16-18',
      result: {
        ok: true,
        value: {
          ref: '요한복음 3:16-18',
          verses: [{verse: 16}, {verse: 17}, {verse: 18}],
        },
      },
    });
    await unlink(join(folder, 'sample.llbible'));
    expect((await session.lookup(request('요 3장 16-18절'))).result).toEqual(
      first.result,
    );
  });

  it('keeps canonical suggestions with the range and handles numbered English books', async () => {
    const {session} = await setup();
    const answer = await session.lookup(request('요한 3:16'));
    expect(answer.suggestions.map(({bookId}) => bookId)).toEqual([
      43, 62, 63, 64, 66,
    ]);
    expect(answer.suggestions[0]?.input).toBe('요한복음 3:16');
    expect(
      (await session.lookup(request('1 John 1:1'))).suggestions[0],
    ).toMatchObject({
      bookId: 62,
      input: '요한일서 1:1',
    });
    expect((await session.lookup(request(''))).suggestions).toEqual([]);
    expect((await session.lookup(request('없는책 1:1'))).result).toMatchObject({
      ok: false,
      error: {code: 'unknownBook'},
    });
  });

  it('reloads only when installed file identities change and reports each skipped file once', async () => {
    const {session, get} = await setup();
    await session.lookup(request());
    const warnings = vi.mocked(log.warn).mock.calls.length;
    get.mockImplementation(() => document('missing.llbible'));
    expect((await session.lookup(request())).result).toMatchObject({
      ok: false,
      error: {code: 'translation'},
    });
    await session.lookup(request());
    expect(log.warn).toHaveBeenCalledTimes(warnings + 1);
  });

  it('rejects unavailable settings and releases queued requests after disposal', async () => {
    const folder = await makeTempDir();
    const unavailable = new BibleLookupSession({
      folder,
      settings: Promise.resolve(null),
      log,
    });
    onTestFinished(() => unavailable.dispose());
    await expect(unavailable.lookup(request())).rejects.toThrow(
      'settings are unavailable',
    );
    const {session} = await setup();
    const pending = session.lookup(request());
    session.dispose();
    await expect(pending).rejects.toThrow('closed');
    await expect(session.lookup(request())).rejects.toThrow('unavailable');
  });

  it('clears a library whose load finishes after disposal', async () => {
    const {session} = await setup();
    const loaded = new library.BibleLibrary([parsedTranslation()]);
    let finish: (value: library.BibleLibrary) => void = () => undefined;
    const loading = new Promise<library.BibleLibrary>(resolve => {
      finish = resolve;
    });
    const load = vi
      .spyOn(library, 'loadBibleLibrary')
      .mockReturnValueOnce(loading);
    onTestFinished(() => finish(loaded));
    const pending = session.lookup(request());
    const rejected = expect(pending).rejects.toThrow('closed');
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    session.dispose();
    finish(loaded);
    await rejected;
    expect(loaded.translations).toEqual([]);
  });

  it('caps pending work and recovers the queue after failures', async () => {
    const folder = await makeTempDir();
    const session = new BibleLookupSession({
      folder,
      settings: Promise.resolve(null),
      log,
    });
    onTestFinished(() => session.dispose());
    const queued = Array.from({length: BIBLE_LOOKUP_LIMITS.pending}, () =>
      session.lookup(request()),
    );
    const settled = Promise.allSettled(queued);
    await expect(session.lookup(request())).rejects.toThrow('unavailable');
    expect((await settled).every(answer => answer.status === 'rejected')).toBe(
      true,
    );
    await expect(session.lookup(request())).rejects.toThrow(
      'settings are unavailable',
    );
  });
});
