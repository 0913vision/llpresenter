export interface PictureRequest {
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly fit: string;
  readonly thumbnail?: boolean;
}

export interface PictureCopy {
  readonly url: string;
  readonly bytes: number;
}

export interface PictureCacheOptions {
  readonly stamp: (source: string) => Promise<string>;
  readonly make: (request: PictureRequest) => Promise<PictureCopy>;
  readonly release: (url: string) => void;
  readonly maxBytes?: number;
  readonly maxEntries?: number;
  readonly stop?: () => void;
}

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_PENDING = 128;

/** Serializes decoding and bounds retained copies by their decoded pixel cost. */
export class PictureCache {
  private readonly entries = new Map<
    string,
    PictureCopy & {source: string; stamp: string}
  >();
  private readonly pending = new Map<string, Promise<string>>();
  private tail = Promise.resolve();
  private bytes = 0;
  private disposed = false;

  constructor(private readonly options: PictureCacheOptions) {}

  get(request: PictureRequest): Promise<string> {
    const key = JSON.stringify(request);
    const pending = this.pending.get(key);
    if (pending !== undefined) return pending;
    if (this.disposed || this.pending.size >= MAX_PENDING) {
      return Promise.resolve(request.source);
    }
    const next = this.tail
      .then(() => this.read(key, request))
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, next);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  dispose(): void {
    this.disposed = true;
    this.options.stop?.();
    for (const key of this.entries.keys()) this.remove(key);
  }

  private async read(key: string, request: PictureRequest): Promise<string> {
    if (this.disposed) return request.source;
    const stamp = await this.options.stamp(request.source);
    if (this.isDisposed()) return request.source;
    const versioned = `${key}\n${stamp}`;
    for (const [entry, copy] of this.entries) {
      if (copy.source === request.source && copy.stamp !== stamp) {
        this.remove(entry);
      }
    }
    const cached = this.entries.get(versioned);
    if (cached !== undefined) {
      this.entries.delete(versioned);
      this.entries.set(versioned, cached);
      return cached.url;
    }
    const copy = await this.options.make(request);
    let valid = false;
    try {
      const currentStamp = await this.options.stamp(request.source);
      valid = !this.isDisposed() && stamp === currentStamp;
    } finally {
      if (!valid) this.options.release(copy.url);
    }
    if (!valid) {
      return request.source;
    }
    const limit = this.options.maxBytes ?? MAX_BYTES;
    if (copy.bytes > limit) {
      this.options.release(copy.url);
      return request.source;
    }
    this.entries.set(versioned, {...copy, source: request.source, stamp});
    this.bytes += copy.bytes;
    while (
      this.bytes > limit ||
      this.entries.size > (this.options.maxEntries ?? MAX_ENTRIES)
    ) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.remove(oldest.value);
    }
    return copy.url;
  }

  private remove(key: string): void {
    const copy = this.entries.get(key);
    if (copy === undefined) return;
    this.entries.delete(key);
    this.bytes -= copy.bytes;
    this.options.release(copy.url);
  }

  private isDisposed(): boolean {
    return this.disposed;
  }
}
