import {afterEach, expect, it, vi} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {defaultPreferences} from '@core/schema/preferences';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {BibleLookupSession} from '@main/bible/lookup';
import {makeTempDir} from '@fixtures/tempDir';
import {
  chunkedTranslationFile,
  translationFile,
} from '@fixtures/core/bible/testFiles';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  flush: async () => undefined,
};
const response =
  '<div id="tdBible1"><span><b class="number">1</b>placeholder</span></div>';
afterEach(() => vi.unstubAllGlobals());
async function setup(partial: boolean, complete = false) {
  const folder = await makeTempDir();
  if (partial) {
    await writeFile(
      join(folder, 'sample.llbible'),
      chunkedTranslationFile(
        translationFile(complete ? BIBLE_BOOKS.map(book => book.id) : [43]),
      ).bytes,
    );
  }
  const document = parseSettingsDocument({
    name: 'bible',
    value: {
      format: 'llsettings.bible',
      schemaVersion: 1,
      translations: [
        {
          id: 'sample',
          name: 'Sample',
          lang: 'ko',
          file: 'sample.llbible',
          default: true,
        },
      ],
      recents: [],
    },
    access: 'editable',
    revision: 1,
  });
  if (!document.ok || document.value.name !== 'bible') {
    throw Error('Invalid settings');
  }
  const value = document.value;
  return new BibleLookupSession({
    folder,
    settings: Promise.resolve({
      get: () => value,
      preferences: () => defaultPreferences,
      subscribe: () => () => undefined,
    }),
    log,
  });
}
function request(input: string) {
  const parsed = parseBibleLookupRequest({input, translation: 'sample'});
  if (!parsed.ok) throw Error('Invalid request');
  return parsed.value;
}
it.each([false, true])(
  'uses live translation for an unavailable or incomplete default: partial=%s',
  async partial => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ok: true, text: async () => response});
    vi.stubGlobal('fetch', fetch);
    const session = await setup(partial);
    try {
      const metadata = await session.lookup(
        request('\uD558\uBC15\uAD6D'),
        false,
        true,
      );
      expect(metadata.bounds?.bookId).toBe(35);
      expect(fetch).not.toHaveBeenCalled();
      const reply = await session.lookup(
        request('\uD558\uBC15\uAD6D 3:1'),
        false,
        true,
      );
      expect(reply.result).toMatchObject({
        ok: true,
        value: {translation: LIVE_BIBLE_ID, verses: [{text: 'placeholder'}]},
      });
      expect(fetch).toHaveBeenCalledOnce();
      const cached = await session.lookup(
        request('\uD558\uBC15\uAD6D 3:1'),
        true,
      );
      expect(cached.result).toMatchObject({
        ok: true,
        value: {translation: LIVE_BIBLE_ID},
      });
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      session.dispose();
    }
  },
);
it('preserves a saved partial translation where its book exists', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const session = await setup(true);
  try {
    const saved = await session.lookup(
      request('\uC694\uD55C\uBCF5\uC74C 3:1'),
      true,
    );
    expect(saved.result).toMatchObject({
      ok: true,
      value: {translation: 'sample'},
    });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    session.dispose();
  }
});

it('uses live text for an operator lookup even when an incomplete default contains the book', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ok: true, text: async () => response});
  vi.stubGlobal('fetch', fetch);
  const session = await setup(true);
  try {
    const reply = await session.lookup(
      request('\uC694\uD55C\uBCF5\uC74C 3:1'),
      false,
      true,
    );
    expect(reply.result).toMatchObject({
      ok: true,
      value: {translation: LIVE_BIBLE_ID},
    });
    expect(fetch).toHaveBeenCalledOnce();
  } finally {
    session.dispose();
  }
});

it('keeps a complete configured default for operator lookups', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const session = await setup(true, true);
  try {
    const reply = await session.lookup(
      request('\uC694\uD55C\uBCF5\uC74C 3:1'),
      false,
      true,
    );
    expect(reply.result).toMatchObject({
      ok: true,
      value: {translation: 'sample'},
    });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    session.dispose();
  }
});
it('resolves the short Habakkuk reference on the live default', async () => {
  const html = `<div id="tdBible1">${Array.from(
    {length: 19},
    (_, index) => `<span><b class="number">${index + 1}</b>placeholder</span>`,
  ).join('')}</div>`;
  const fetch = vi.fn().mockResolvedValue({ok: true, text: async () => html});
  vi.stubGlobal('fetch', fetch);
  const session = await setup(false);
  try {
    expect(
      (await session.lookup(request('\uD569'), false, true)).bounds?.bookId,
    ).toBe(35);
    const result = await session.lookup(request('\uD569 3:17-19'), false, true);
    expect(result.result).toMatchObject({
      ok: true,
      value: {
        translation: LIVE_BIBLE_ID,
        verses: [{verse: 17}, {verse: 18}, {verse: 19}],
      },
    });
  } finally {
    session.dispose();
  }
});
