import type {FontCatalog} from '@shared/schema/fontCatalog';
import type {Logger} from '../log';

const CACHE_MS = 60_000;
const RETRY_MS = 10_000;

/** Coalesces reads, retains the last good list, and releases the native reader on shutdown. */
export class FontCatalogCache {
  private value: FontCatalog | undefined;
  private failure: Error | undefined;
  private freshUntil = 0;
  private pending: Promise<FontCatalog> | undefined;
  private controller: AbortController | undefined;
  private disposed = false;

  constructor(
    private readonly options: {
      readonly read: (signal: AbortSignal) => Promise<FontCatalog>;
      readonly log: Pick<Logger, 'warn'>;
      readonly now?: () => number;
    },
  ) {}

  get(): Promise<FontCatalog> {
    if (this.disposed) {
      return Promise.reject(new Error('Font catalog is closed'));
    }
    if (this.pending !== undefined) return this.pending;
    if (this.now() < this.freshUntil) {
      if (this.value !== undefined) return Promise.resolve(this.value);
      if (this.failure !== undefined) return Promise.reject(this.failure);
    }
    const controller = new AbortController();
    this.controller = controller;
    this.pending = Promise.resolve()
      .then(() => this.options.read(controller.signal))
      .then(value => {
        if (this.disposed) throw new Error('Font catalog is closed');
        this.value = value;
        this.failure = undefined;
        this.freshUntil = this.now() + CACHE_MS;
        return value;
      })
      .catch((cause: unknown) => {
        if (this.disposed) throw new Error('Font catalog is closed');
        this.options.log.warn('Could not read installed fonts', cause);
        this.freshUntil = this.now() + RETRY_MS;
        if (this.value !== undefined) return this.value;
        this.failure = new Error('Could not read installed fonts');
        throw this.failure;
      })
      .finally(() => {
        this.pending = undefined;
        this.controller = undefined;
      });
    return this.pending;
  }

  dispose(): void {
    this.disposed = true;
    this.value = undefined;
    this.failure = undefined;
    this.controller?.abort();
  }

  private now(): number {
    return this.options.now?.() ?? performance.now();
  }
}
