import type {SettingsReader} from '@core/schema/settingsReader';
import {unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseBibleLookupRequest,
  BIBLE_LOOKUP_LIMITS,
} from '@core/schema/bibleLookup';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {defaultPreferences} from '@core/schema/preferences';
import {makeTempDir} from '../../../test/temp-dir';
import {BibleLookupSession} from './lookup';
import * as library from './library';
import * as chapterFile from './chapterFile';
import {chunkedTranslationFile} from './testFiles';

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
  if (!parsed.ok || parsed.value.name !== 'bible') {
    throw new Error('Invalid Bible settings fixture');
  }
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
    chunkedTranslationFile().bytes,
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
  return {folder, session, get, settings};
}

describe('Bible lookup session', () => {
  it('returns chapter bounds for a book-only request without reading chapter text', async () => {
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    const {session} = await setup();
    const answer = await session.lookup(request('요한복음'));
    expect(answer.bounds).toEqual({
      bookId: 43,
      chapterVerses: Array.from({length: 21}, (_, index) =>
        index === 2 ? 36 : 8,
      ),
    });
    expect(answer.result.ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect((await session.lookup(request('베'))).bounds).toBeUndefined();
    expect((await session.lookup(request('창세기'))).bounds).toBeUndefined();
  });

  it.each([
    {input: '요 3:16-99', code: 'verse'},
    {input: '요 3장 35절-4장 9절', code: 'verse'},
    {input: '요 3:16-22:1', code: 'chapter'},
  ])(
    'rejects an out-of-range endpoint in $input without resolving suggestions',
    async ({input, code}) => {
      const {session} = await setup();
      const reply = await session.lookup(request(input));
      expect(reply.result).toMatchObject({ok: false, error: {code}});
      expect(reply.suggestions).toHaveLength(1);
      expect(reply.suggestions[0]?.resolved).toBeUndefined();
    },
  );
  it('indexes headers at startup before the first request without loading chapters', async () => {
    const load = vi.spyOn(library, 'loadBibleLibrary');
    const read = vi.spyOn(chapterFile, 'readBibleChapter');
    const {session} = await setup();
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    const loading = load.mock.results[0];
    if (loading?.type !== 'return') throw new Error('Missing startup load');
    const indexed = await loading.value;
    expect(indexed.translations).toHaveLength(1);
    expect(read).not.toHaveBeenCalled();
    expect((await session.lookup(request())).result.ok).toBe(true);
    expect(read).toHaveBeenCalledOnce();
  });
  it.each(['요 3장 16절', '요 3장 16-18절'])(
    'returns canonical suggestion identity and counts for %s',
    async input => {
      const {session} = await setup();
      const reply = await session.lookup(request(input));
      if (!reply.result.ok) throw new Error('Expected a resolved passage');
      expect(reply.suggestions[0]).toMatchObject({
        input: input.replace('요 ', '요한복음 '),
        resolved: {
          ref: reply.result.value.ref,
          verseCount: reply.result.value.verses.length,
        },
      });
    },
  );
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
    get.mockImplementation(() => document('other-missing.llbible'));
    await session.lookup(request());
    expect(log.warn).toHaveBeenCalledTimes(warnings + 2);
    get.mockImplementation(() => document('missing.llbible'));
    await session.lookup(request());
    expect(log.warn).toHaveBeenCalledTimes(warnings + 2);
  });

  it('bounds remembered bad files while suppressing recent duplicate warnings', async () => {
    const {session, get} = await setup();
    await session.lookup(request());
    const warnings = vi.mocked(log.warn).mock.calls.length;
    for (let index = 0; index < 129; index++) {
      get.mockImplementation(() => document(`missing-${index}.llbible`));
      await session.lookup(request());
    }
    expect(log.warn).toHaveBeenCalledTimes(warnings + 129);
    get.mockImplementation(() => document('missing-128.llbible'));
    await session.lookup(request());
    expect(log.warn).toHaveBeenCalledTimes(warnings + 129);
    get.mockImplementation(() => document('missing-0.llbible'));
    await session.lookup(request());
    expect(log.warn).toHaveBeenCalledTimes(warnings + 130);
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
    const {session: initial, folder, settings} = await setup();
    initial.dispose();
    const loaded = await library.loadBibleLibrary({
      folder,
      translations: document().value.translations,
      onProblem: log.warn,
    });
    let finish: (value: library.BibleLibrary) => void = () => undefined;
    const loading = new Promise<library.BibleLibrary>(resolve => {
      finish = resolve;
    });
    const load = vi
      .spyOn(library, 'loadBibleLibrary')
      .mockReturnValueOnce(loading);
    const session = new BibleLookupSession({
      folder,
      settings: Promise.resolve(settings),
      log,
    });
    onTestFinished(() => session.dispose());
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

  it('rejects a request disposed during its chapter read without returning late text', async () => {
    const {session} = await setup();
    let finish: (verses: readonly string[]) => void = () => undefined;
    const reading = new Promise<readonly string[]>(resolve => {
      finish = resolve;
    });
    const read = vi
      .spyOn(chapterFile, 'readBibleChapter')
      .mockReturnValueOnce(reading);
    onTestFinished(() => finish([]));
    const pending = session.lookup(request());
    const rejected = expect(pending).rejects.toThrow('closed');
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    session.dispose();
    finish(['Invented late sentence.']);
    await rejected;
  });
});
