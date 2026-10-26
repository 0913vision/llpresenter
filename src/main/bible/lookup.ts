import {
  BIBLE_LOOKUP_LIMITS,
  parseBibleLookupReply,
  type BibleLookupReply,
  type BibleLookupRequest,
} from '@shared/schema/bibleLookup';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import {BibleLibrary, loadBibleLibrary} from './library';
import {matchBooks} from '@shared/bibleMatching';

const BOOK_PREFIX = /^((?:[1-3]\s*)?[\p{L}\p{M}\s]+)(.*)$/u;

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
    const result = await library.resolve(request.translation, input);
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
  private readonly warnedFiles = new Set<string>();
  private translationsKey: string | null = null;
  private pending: Promise<void> = Promise.resolve();
  private waiting = 0;
  private disposed = false;

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

  lookup(request: BibleLookupRequest): Promise<BibleLookupReply> {
    if (this.disposed || this.waiting >= BIBLE_LOOKUP_LIMITS.pending) {
      return Promise.reject(new Error('Bible lookup is unavailable'));
    }
    this.waiting++;
    const answer = this.pending.then(() => this.resolve(request));
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
    const key = JSON.stringify(
      document.value.translations.map(({id, file}) => ({id, file})),
    );
    if (key !== this.translationsKey) {
      const loaded = await loadBibleLibrary({
        folder: this.options.folder,
        translations: document.value.translations,
        onProblem: problem => {
          if (this.disposed || this.warnedFiles.has(problem.file)) return;
          this.warnedFiles.add(problem.file);
          this.options.log.warn('skipped a Bible translation', problem);
        },
      });
      if (this.disposed) {
        loaded.clear();
        this.ensureOpen();
      }
      this.library?.clear();
      this.library = loaded;
      this.translationsKey = key;
    }
    return this.library;
  }

  private async resolve(
    request: BibleLookupRequest,
  ): Promise<BibleLookupReply> {
    const library = await this.refresh();
    if (!library) throw new Error('Bible settings are unavailable');
    const result = await library.resolve(request.translation, request.input);
    const candidates = await suggestions(request, library);
    const [, name = ''] = BOOK_PREFIX.exec(request.input.trim()) ?? [];
    const bounds = library.bounds(request.translation, name);
    this.ensureOpen();
    const reply = parseBibleLookupReply(request, {
      ...request,
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
