import {relative} from 'node:path';
import {parseMediaId, type MediaId} from '@core/schema/ids';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import type {Logger} from '../log';
import type {Analysis, AnalysisRequest} from './mediaAnalyser';
import type {ThumbnailCache} from './thumbnailCache';

/** How many thumbnails may be made at once; one import batch. */
export const MAX_THUMBNAILS_IN_PROGRESS = MEDIA_LIMITS.importBatch;

/** What thumbnails use of the media store. */
export interface ThumbnailSource {
  get(): MediaDocument;
  /** The item's absolute file, or null when its path is refused. */
  fileOf(mediaId: string): string | null;
  subscribe(listener: (document: MediaDocument) => void): () => void;
}

interface Picture {
  readonly source: ThumbnailSource;
  readonly kind: 'video' | 'image';
  readonly file: string;
}

function samePath(current: string | null, file: string): boolean {
  return (
    current !== null && (current === file || relative(current, file) === '')
  );
}

/** The arguments of the {@link Thumbnails} constructor. */
export interface ThumbnailsOptions {
  readonly cache: Pick<ThumbnailCache, 'fileOf' | 'put' | 'remove'>;
  readonly analyse: (request: AnalysisRequest) => Promise<Analysis>;
  readonly source: Promise<ThumbnailSource | null>;
  readonly log: Logger;
}

/**
 * The media tiles' thumbnails (spec 05, "Media"): kept in the cache, made on
 * the first request through analysis when there is none, and dropped when an
 * item's file changes or the item leaves the media list. Audio has none. A
 * file that analysis refused isn't tried again until its path changes.
 */
export class Thumbnails {
  private readonly making = new Map<MediaId, Promise<string | null>>();
  private readonly failed = new Map<MediaId, string>();
  private readonly files = new Map<MediaId, string | null>();
  private stopSource: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly options: ThumbnailsOptions) {}

  /** Follows the media list, so a changed or removed file loses its thumbnail. */
  async start(): Promise<void> {
    const source = await this.options.source;
    if (source === null || this.disposed || this.stopSource !== null) return;
    this.stopSource = source.subscribe(document => {
      this.follow(source, document);
    });
    this.follow(source, source.get());
  }

  /** The thumbnail file of a media id from a URL, made now when needed; null when there is none. */
  async thumbnailOf(value: string): Promise<string | null> {
    const id = parseMediaId(value);
    if (!id.ok || this.disposed) return null;
    const mediaId = id.value;
    if ((await this.picture(mediaId)) === null) return null;
    const cached = await this.options.cache.fileOf(mediaId);
    if (cached !== null) return cached;
    const running = this.making.get(mediaId);
    if (running !== undefined) return running;
    if (this.making.size >= MAX_THUMBNAILS_IN_PROGRESS) return null;
    const made = this.make(mediaId).finally(() => {
      this.making.delete(mediaId);
    });
    this.making.set(mediaId, made);
    return made;
  }

  /**
   * Keeps the thumbnail an import made from a file, only while the item still
   * has that file: a relink or a delete during the import's save, or during
   * this write, drops it. Never throws.
   */
  async save(mediaId: MediaId, jpeg: Uint8Array, file: string): Promise<void> {
    const picture = await this.picture(mediaId);
    if (picture !== null && samePath(picture.file, file)) {
      await this.keep(picture, mediaId, jpeg);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopSource?.();
    this.stopSource = null;
  }

  private follow(source: ThumbnailSource, document: MediaDocument): void {
    const ids = new Set(document.value.items.map(({id}) => id));
    for (const id of [...this.files.keys()]) {
      if (!ids.has(id)) this.forget(id);
    }
    for (const {id} of document.value.items) {
      const file = source.fileOf(id);
      if (this.files.has(id) && this.files.get(id) !== file) this.forget(id);
      this.files.set(id, file);
    }
  }

  private forget(mediaId: MediaId): void {
    this.files.delete(mediaId);
    this.failed.delete(mediaId);
    this.options.cache.remove(mediaId).catch((error: unknown) => {
      this.options.log.warn('could not drop a thumbnail', error);
    });
  }

  // NOTE(0913vision): Only an item in the list now, with a picture and a path
  // the library accepts, has a thumbnail, cached or not.
  private async picture(mediaId: MediaId): Promise<Picture | null> {
    const source = await this.options.source;
    const item = source?.get().value.items.find(({id}) => id === mediaId);
    const file = source?.fileOf(mediaId) ?? null;
    if (
      this.disposed ||
      source === null ||
      item === undefined ||
      item.kind === 'audio' ||
      file === null
    ) {
      return null;
    }
    return {source, kind: item.kind, file};
  }

  private async make(mediaId: MediaId): Promise<string | null> {
    const picture = await this.picture(mediaId);
    if (picture === null || this.failed.get(mediaId) === picture.file) {
      return null;
    }
    const analysis = await this.options.analyse({
      file: picture.file,
      kind: picture.kind,
      thumbnail: true,
    });
    if (
      this.disposed ||
      !samePath(picture.source.fileOf(mediaId), picture.file)
    ) {
      return null;
    }
    if (analysis.kind === 'read' && analysis.facts.thumbnail !== undefined) {
      return this.keep(picture, mediaId, analysis.facts.thumbnail);
    }
    if (analysis.kind !== 'unavailable') this.remember(mediaId, picture.file);
    return null;
  }

  // NOTE(0913vision): The file can change while the thumbnail is written, so
  // it is checked again after the write.
  private async keep(
    {source, file}: Picture,
    mediaId: MediaId,
    jpeg: Uint8Array,
  ): Promise<string | null> {
    const kept = await this.options.cache.put(mediaId, jpeg);
    if (samePath(source.fileOf(mediaId), file)) return kept;
    await this.options.cache.remove(mediaId);
    return null;
  }

  private remember(mediaId: MediaId, file: string): void {
    this.failed.delete(mediaId);
    this.failed.set(mediaId, file);
    const [oldest] = this.failed.keys();
    if (this.failed.size > MEDIA_LIMITS.items && oldest !== undefined) {
      this.failed.delete(oldest);
    }
  }
}
