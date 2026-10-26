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

function suggestions(request: BibleLookupRequest, library: BibleLibrary) {
  const [, name = '', range = ''] =
    BOOK_PREFIX.exec(request.input.trim()) ?? [];
  return matchBooks(name).flatMap(book => {
    const input = `${book.korean} ${range.trim()}`.trim();
    if (input.length > BIBLE_LOOKUP_LIMITS.input) return [];
    const result = library.resolve(request.translation, input);
    return [
      {
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
      },
    ];
  });
}

/** Serializes lazy library reloads and caps requests waiting for disk reads. */
export class BibleLookupSession {
  private library = new BibleLibrary([]);
  private translationsKey: string | null = null;
  private pending: Promise<void> = Promise.resolve();
  private waiting = 0;
  private disposed = false;

  constructor(private readonly options: BibleLookupOptions) {}

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
    this.library.clear();
  }

  private ensureOpen(): void {
    if (this.disposed) throw new Error('Bible lookup was closed');
  }

  private async resolve(
    request: BibleLookupRequest,
  ): Promise<BibleLookupReply> {
    this.ensureOpen();
    const settings = await this.options.settings;
    this.ensureOpen();
    const document = settings?.get('bible');
    if (document?.name !== 'bible') {
      throw new Error('Bible settings are unavailable');
    }
    const key = JSON.stringify(
      document.value.translations.map(({id, file}) => ({id, file})),
    );
    if (key !== this.translationsKey) {
      const loaded = await loadBibleLibrary({
        folder: this.options.folder,
        translations: document.value.translations,
        onProblem: problem =>
          this.options.log.warn('skipped a Bible translation', problem),
      });
      if (this.disposed) {
        loaded.clear();
        this.ensureOpen();
      }
      this.library.clear();
      this.library = loaded;
      this.translationsKey = key;
    }
    const result = this.library.resolve(request.translation, request.input);
    const reply = parseBibleLookupReply(request, {
      ...request,
      suggestions: suggestions(request, this.library),
      result,
    });
    if (!reply.ok) {
      throw new Error(`Invalid Bible lookup reply: ${reply.error.message}`);
    }
    return reply.value;
  }
}
