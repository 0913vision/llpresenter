import {stat} from 'node:fs/promises';
import type {MediaId} from '@shared/schema/ids';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import type {MissingMedia} from '@shared/schema/mediaFiles';

/** How many media files the check reads at once. */
export const MAX_PARALLEL_FILE_CHECKS = 8;

/**
 * How long changes gather before the list is pushed, so a launch check of many
 * files sends a few lists instead of one per file.
 */
export const MISSING_PUBLISH_DELAY_MS = 250;

/** What the check uses of the media store. */
export interface MissingFilesSource {
  get(): MediaDocument;
  /** The item's absolute file, or null when its path is refused. */
  fileOf(mediaId: string): string | null;
  subscribe(listener: (document: MediaDocument) => void): () => void;
}

/** Whether a path is a file that can be read. Never throws. */
export async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/** The arguments of the {@link MissingFiles} constructor. */
export interface MissingFilesOptions {
  readonly source: MissingFilesSource;
  readonly onChange: (missing: MissingMedia) => void;
  readonly exists?: (file: string) => Promise<boolean>;
  /** {@link MISSING_PUBLISH_DELAY_MS} by default. */
  readonly publishDelayMs?: number;
}

/**
 * Which media files can't be found (spec 08, "Missing media file"): every
 * file at launch, an item's file again whenever it changes, and one file on
 * request, as after it failed to play. A refused path counts as missing.
 * Only the newest check of an item counts.
 */
export class MissingFiles {
  private readonly missing = new Set<MediaId>();
  private readonly checkedFiles = new Map<MediaId, string | null>();
  private readonly checks = new Map<MediaId, number>();
  // NOTE(0913vision): A Set keeps the order and lets each item wait once.
  private readonly queue = new Set<MediaId>();
  private running = 0;
  private serial = 0;
  private published: MissingMedia = [];
  private publishTimer: ReturnType<typeof setTimeout> | null = null;
  private stopSource: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly options: MissingFilesOptions) {}

  /** Checks every file now and follows the media list from here on. */
  start(): void {
    if (this.disposed || this.stopSource !== null) return;
    this.stopSource = this.options.source.subscribe(document => {
      this.follow(document);
    });
    this.follow(this.options.source.get());
  }

  /** Checks one item's file again. */
  check(mediaId: MediaId): void {
    if (this.checkedFiles.has(mediaId)) this.enqueue(mediaId);
  }

  /** How many checks wait for a free worker; at most the media items. */
  get waitingChecks(): number {
    return this.queue.size;
  }

  isMissing(mediaId: MediaId): boolean {
    return this.missing.has(mediaId);
  }

  /** The missing media now, in media list order. */
  list(): MissingMedia {
    return this.options.source
      .get()
      .value.items.map(item => item.id)
      .filter(id => this.missing.has(id));
  }

  dispose(): void {
    this.disposed = true;
    this.stopSource?.();
    this.stopSource = null;
    this.queue.clear();
    if (this.publishTimer !== null) clearTimeout(this.publishTimer);
    this.publishTimer = null;
  }

  private follow(document: MediaDocument): void {
    const ids = new Set(document.value.items.map(item => item.id));
    for (const id of [...this.checkedFiles.keys()]) {
      if (ids.has(id)) continue;
      this.checkedFiles.delete(id);
      this.checks.delete(id);
      this.missing.delete(id);
      this.queue.delete(id);
    }
    for (const item of document.value.items) {
      const file = this.options.source.fileOf(item.id);
      if (
        this.checkedFiles.has(item.id) &&
        this.checkedFiles.get(item.id) === file
      ) {
        continue;
      }
      this.checkedFiles.set(item.id, file);
      this.enqueue(item.id);
    }
    this.schedulePublish();
  }

  private enqueue(mediaId: MediaId): void {
    if (this.disposed) return;
    this.checks.set(mediaId, ++this.serial);
    this.queue.add(mediaId);
    this.pump();
  }

  private pump(): void {
    while (
      !this.disposed &&
      this.running < MAX_PARALLEL_FILE_CHECKS &&
      this.queue.size > 0
    ) {
      const [mediaId] = this.queue;
      if (mediaId === undefined) return;
      this.queue.delete(mediaId);
      this.running++;
      const done = (): void => {
        this.running--;
        this.pump();
      };
      this.checkOne(mediaId).then(done, done);
    }
  }

  private async checkOne(mediaId: MediaId): Promise<void> {
    const check = this.checks.get(mediaId);
    const file = this.checkedFiles.get(mediaId) ?? null;
    const exists =
      file !== null && (await (this.options.exists ?? fileExists)(file));
    if (
      this.disposed ||
      check === undefined ||
      this.checks.get(mediaId) !== check
    ) {
      return;
    }
    if (exists) this.missing.delete(mediaId);
    else this.missing.add(mediaId);
    this.schedulePublish();
  }

  private schedulePublish(): void {
    if (this.disposed || this.publishTimer !== null) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.publish();
    }, this.options.publishDelayMs ?? MISSING_PUBLISH_DELAY_MS);
  }

  private publish(): void {
    if (this.disposed) return;
    const next = this.list();
    if (
      next.length === this.published.length &&
      next.every((id, index) => id === this.published[index])
    ) {
      return;
    }
    this.published = next;
    this.options.onChange(next);
  }
}
