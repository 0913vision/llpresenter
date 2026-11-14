import {BibleChapterCache} from './chapterCache';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import type {SettingsReader} from '@core/schema/settingsReader';
import {
  BIBLE_LOOKUP_LIMITS,
  parseBibleLookupReply,
  type BibleLookupReply,
  type BibleLookupRequest,
} from '@core/schema/bibleLookup';
import type {Logger} from '../log';
import {BibleLibrary, loadBibleLibrary} from './library';
import {matchBooks} from '@core/bible/bibleMatching';

const BOOK_PREFIX = /^((?:[1-3]\s*)?[\p{L}\p{M}\s]+)(.*)$/u;
const WARNED_FILE_LIMIT = 128;

export interface BibleLookupOptions {
  readonly folder: string;
  readonly settings: Promise<SettingsReader | null>;
  readonly log: Logger;
}

async function suggestions(request: BibleLookupRequest, library: BibleLibrary) {
  const [, name = '', range = ''] =
    BOOK_PREFIX.exec(request.input.trim()) ?? [];
  const candidates = [];
  for (const book of matchBooks(name)) {
    const input = `${book.korean} ${range.trim()}`.trim();
    if (input.length > BIBLE_LOOKUP_LIMITS.input) continue;
    const result = await library.resolve(
      request.translation,
      input,
      request.translation === LIVE_BIBLE_ID,
    );
    candidates.push({
      bookId: book.id,
      name: book.korean,
      input,
      ...(result.ok
        ? {
            resolved: {
              ref: result.value.ref,
              verseCount: result.value.verses.length,
            },
          }
        : {}),
    });
  }
  return candidates;
}

/** Primes header indexes at startup and caps serialized lookup work. */
export class BibleLookupSession {
  private library: BibleLibrary | null = null;
  private readonly cache = new BibleChapterCache();
  private readonly warnedFiles = new Set<string>();
  private translationsKey: string | null = null;
  private defaultTranslation: string | undefined;
  private pending: Promise<void> = Promise.resolve();
  private waiting = 0;
  private disposed = false;
  private needsRefresh = false;

  constructor(private readonly options: BibleLookupOptions) {
    this.pending = this.refresh().then(
      () => undefined,
      (error: unknown) => {
        if (!this.disposed) {
          this.options.log.warn('could not index Bible translations', error);
        }
      },
    );
  }

  lookup(
    request: BibleLookupRequest,
    cacheOnly = false,
    operatorLookup = false,
  ): Promise<BibleLookupReply> {
    if (this.disposed || this.waiting >= BIBLE_LOOKUP_LIMITS.pending) {
      return Promise.reject(new Error('Bible lookup is unavailable'));
    }
    this.waiting++;
    const answer = this.pending.then(() =>
      this.resolve(request, {cacheOnly, operatorLookup}),
    );
    this.pending = answer.then(
      () => {
        this.waiting--;
      },
      () => {
        this.waiting--;
      },
    );
    return answer;
  }

  dispose(): void {
    this.disposed = true;
    this.library?.clear();
    this.library = null;
    this.warnedFiles.clear();
  }

  private ensureOpen(): void {
    if (this.disposed) throw new Error('Bible lookup was closed');
  }

  private async refresh(): Promise<BibleLibrary | null> {
    this.ensureOpen();
    const settings = await this.options.settings;
    this.ensureOpen();
    const document = settings?.get('bible');
    if (document?.name !== 'bible') {
      return null;
    }
    this.defaultTranslation =
      document.value.translations.find(item => item.default)?.id ??
      document.value.translations[0]?.id;
    const key = JSON.stringify(
      document.value.translations.map(({id, file}) => ({id, file})),
    );
    if (key !== this.translationsKey || this.needsRefresh) {
      this.needsRefresh = false;
      const loaded = await loadBibleLibrary({
        folder: this.options.folder,
        cache: this.cache,
        translations: document.value.translations,
        onProblem: problem => {
          this.needsRefresh = true;
          if (this.disposed || this.warnedFiles.has(problem.file)) return;
          if (this.warnedFiles.size >= WARNED_FILE_LIMIT) {
            const oldest = this.warnedFiles.values().next().value;
            if (oldest !== undefined) this.warnedFiles.delete(oldest);
          }
          this.warnedFiles.add(problem.file);
          this.options.log.warn('skipped a Bible translation', problem);
        },
      });
      if (this.disposed) {
        loaded.clear();
        this.ensureOpen();
      }
      this.library?.clear(true);
      this.library = loaded;
      this.translationsKey = key;
    }
    return this.library;
  }

  private async resolve(
    request: BibleLookupRequest,
    {
      cacheOnly,
      operatorLookup,
    }: {readonly cacheOnly: boolean; readonly operatorLookup: boolean},
  ): Promise<BibleLookupReply> {
    const library = await this.refresh();
    if (!library) throw new Error('Bible settings are unavailable');
    const [, name = ''] = BOOK_PREFIX.exec(request.input.trim()) ?? [];
    const matches = matchBooks(name);
    const missingBook =
      matches.length === 1 &&
      library.bounds(request.translation, name) === undefined;
    const target =
      request.translation !== LIVE_BIBLE_ID &&
      (cacheOnly || operatorLookup) &&
      (!library.hasTranslation(request.translation) ||
        missingBook ||
        (operatorLookup &&
          request.translation === this.defaultTranslation &&
          !library.complete(request.translation)))
        ? LIVE_BIBLE_ID
        : request.translation;
    let result = await library.resolve(target, request.input, cacheOnly);
    if (
      !result.ok &&
      result.error.code === 'translation' &&
      target !== LIVE_BIBLE_ID &&
      (cacheOnly || operatorLookup) &&
      !library.hasTranslation(target)
    ) {
      result = await library.resolve(LIVE_BIBLE_ID, request.input, cacheOnly);
    }
    const effective = result.ok ? result.value.translation : target;
    const candidates = await suggestions(
      {...request, translation: effective},
      library,
    );
    const bounds = library.bounds(effective, name);
    this.ensureOpen();
    const reply = parseBibleLookupReply(request, {
      ...request,
      effectiveTranslation: effective,
      suggestions: candidates,
      ...(bounds === undefined ? {} : {bounds}),
      result,
    });
    if (!reply.ok) {
      throw new Error(`Invalid Bible lookup reply: ${reply.error.message}`);
    }
    return reply.value;
  }
}
