import type {Label} from '@core/schema/labels';
import type {MediaChoice} from '@core/live/state';
import {isItemOfKind} from '@core/schema/service';
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
    for (const item of service.data.order) {
      if (!isItemOfKind(item, 'song')) continue;
      const song = songs.get(item.song);
      if (song === undefined) continue;
      const id = songBackgroundId(item, song.data);
      if (id === undefined || checked.has(id)) continue;
      checked.add(id);
      const background = await this.sources.backgroundOf(id);
      if (background !== null) backgrounds.set(id, background);
    }
    return buildShowService({
      service,
      songs,
      labels,
      revision: FIRST_REVISION,
      backgrounds,
      ...(this.sources.bible === undefined
        ? {}
        : {
            passages: await resolveServicePassages(
              service.data.order,
              this.sources.bible,
              {
                reportError: this.reportError,
                isCurrent: () => this.canPublish(),
              },
            ),
          }),
    });
  }
}
