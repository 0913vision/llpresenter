import type {Label} from '@core/schema/labels';
import type {MediaChoice} from '@core/live/state';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import type {MediaItem} from '@core/schema/mediaList';
import type {ShowService} from '@core/schema/showService';
import type {ContentStore} from './contentStore';
import {buildShowService, songBackgroundId} from './showService';
import {resolveServicePassages} from '../bible/servicePassages';
import type {BibleLookupSession} from '../bible/lookup';

const FIRST_REVISION = 1;

export interface OpenServiceSources {
  /** The 예배 순서 that 진행 opened, or `null` for none. */
  readonly serviceId: string | null;
  readonly labels: readonly Label[];
  readonly content: Pick<ContentStore, 'storedService' | 'storedSongs'>;
  readonly backgroundOf: (mediaId: string) => Promise<MediaChoice | null>;
  readonly bible?: Pick<BibleLookupSession, 'lookup'>;
  readonly backgroundBible?: Pick<BibleLookupSession, 'lookup'> | undefined;
  /** The media list, for the names of media items. */
  readonly mediaItems?: () => readonly MediaItem[];
}

/**
 * The open 예배 순서 as 진행 shows it, built from the current content. When a
 * change alters what 진행 shows, such as a song's lyrics or the item order,
 * the next `ShowService` goes out one revision higher; a change that doesn't
 * alter it sends nothing.
 */
export class OpenServiceFeed {
  private revision = 0;
  private lastShown = JSON.stringify(null);
  private shown: ShowService | null = null;
  private pending = false;
  private refreshing: Promise<void> | null = null;
  private disposed = false;
  private initialized = false;
  private readonly liveLoads = new Map<string, 'loading' | 'failed' | 'done'>();
  private readonly liveQueue: Array<{
    key: string;
    translation: string;
    ref: string;
  }> = [];
  private liveWorker = false;

  constructor(
    private readonly sources: OpenServiceSources,
    private readonly push: (service: ShowService | null) => void,
    private readonly reportError: (error: unknown) => void,
  ) {}

  current(): ShowService | null {
    return this.shown;
  }

  /** Rechecks background files and sends the projection only when it changed. */
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.pending = true;
    this.refreshing ??= this.flush().finally(() => {
      this.refreshing = null;
      return this.pending && !this.disposed ? this.refresh() : undefined;
    });
    return this.refreshing;
  }

  /** Stops pushes and awaits any file checks already in flight. */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.pending = false;
    await this.refreshing;
  }

  private async flush(): Promise<void> {
    while (this.pending && !this.disposed) {
      this.pending = false;
      try {
        const next = await this.build();
        if (!this.canPublish()) continue;
        const key = JSON.stringify(next);
        if (key === this.lastShown) {
          this.initialized = true;
          continue;
        }
        this.lastShown = key;
        this.revision++;
        this.shown = next === null ? null : {...next, revision: this.revision};
        if (this.initialized) this.push(this.shown);
        this.initialized = true;
      } catch (error: unknown) {
        this.reportError(error);
      }
    }
  }

  private canPublish(): boolean {
    return !this.pending && !this.disposed;
  }

  /** Schedule missing live passages separately from service opening and output. */
  private scheduleLive(
    items: readonly ServiceItem[],
    unavailable: ReadonlySet<string>,
  ): ReadonlySet<string> {
    const loading = new Set<string>();
    if (this.sources.backgroundBible === undefined) return loading;
    for (const item of items) {
      if (!unavailable.has(item.id)) continue;
      const passage = isItemOfKind(item, 'sermon')
        ? item.sermon.passage
        : isItemOfKind(item, 'bible')
          ? item.bible
          : undefined;
      if (passage?.translation !== LIVE_BIBLE_ID) continue;
      const key = JSON.stringify([passage.translation, passage.ref]);
      const status = this.liveLoads.get(key);
      if (status === undefined) {
        this.liveLoads.set(key, 'loading');
        this.liveQueue.push({
          key,
          translation: passage.translation,
          ref: passage.ref,
        });
      }
      if (status === undefined || status === 'loading') loading.add(item.id);
    }
    if (!this.liveWorker && this.liveQueue.length > 0) {
      this.liveWorker = true;
      setTimeout(() => {
        this.runLiveQueue().catch(this.reportError);
      }, 0);
    }
    return loading;
  }

  private async runLiveQueue(): Promise<void> {
    try {
      while (!this.disposed && this.liveQueue.length > 0) {
        const job = this.liveQueue.shift();
        if (job === undefined) break;
        const ok = await this.fetchLiveJob(job);
        this.liveLoads.set(job.key, ok ? 'done' : 'failed');
        if (this.canPublish()) await this.refresh();
      }
    } finally {
      this.liveWorker = false;
    }
  }

  private async fetchLiveJob(job: {
    translation: string;
    ref: string;
  }): Promise<boolean> {
    const request = parseBibleLookupRequest({
      translation: job.translation,
      input: job.ref,
    });
    if (!request.ok || this.sources.backgroundBible === undefined) return false;
    try {
      return (await this.sources.backgroundBible.lookup(request.value)).result
        .ok;
    } catch (error: unknown) {
      this.reportError(error);
      return false;
    }
  }

  private async build(): Promise<ShowService | null> {
    const {serviceId, labels, content} = this.sources;
    const service =
      serviceId === null ? undefined : content.storedService(serviceId);
    if (service === undefined) {
      return null;
    }
    const songs = content.storedSongs();
    const checked = new Set<string>();
    const backgrounds = new Map<string, MediaChoice>();
    const media = this.sources.mediaItems;
    const mediaById =
      media === undefined
        ? undefined
        : new Map(media().map(item => [item.id, item]));
    const check = async (id: string | undefined): Promise<void> => {
      if (id === undefined || checked.has(id)) return;
      checked.add(id);
      const background = await this.sources.backgroundOf(id);
      if (background !== null) backgrounds.set(id, background);
    };
    for (const item of service.data.order) {
      if ('background' in item && typeof item.background === 'string') {
        await check(item.background);
      }
      if (isItemOfKind(item, 'slides')) continue;
      if (isItemOfKind(item, 'media')) {
        await check(item.media);
        continue;
      }
      if (!isItemOfKind(item, 'song')) continue;
      const song = songs.get(item.song);
      if (song === undefined) continue;
      await check(songBackgroundId(item, song.data));
    }
    const passages =
      this.sources.bible === undefined
        ? undefined
        : await resolveServicePassages(service.data.order, this.sources.bible, {
            reportError: this.reportError,
            isCurrent: () => this.canPublish(),
          });
    if (!this.canPublish()) return null;
    const loading =
      passages === undefined
        ? new Set<string>()
        : this.scheduleLive(service.data.order, passages.unavailable);
    const built = buildShowService({
      service,
      serviceRevision: service.revision,
      songs,
      labels,
      revision: FIRST_REVISION,
      backgrounds,
      ...(mediaById === undefined ? {} : {media: mediaById}),
      ...(passages === undefined ? {} : {passages}),
    });
    return {
      ...built,
      rows: built.rows.map(row =>
        loading.has(row.id) &&
        row.kind !== 'header' &&
        row.problem === 'missing-bible'
          ? {...row, problem: 'loading-bible' as const}
          : row,
      ),
    };
  }
}
