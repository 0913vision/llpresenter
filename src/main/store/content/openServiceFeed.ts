import type {Label} from '@core/schema/services/labels';
import type {ShowService} from '@core/schema/services/showService';
import type {ContentStore} from './contentStore';
import {buildShowService} from './showService';

const FIRST_REVISION = 1;

export interface OpenServiceSources {
  /** The 예배 순서 that 진행 opened, or `null` for none. */
  readonly serviceId: string | null;
  readonly labels: readonly Label[];
  readonly content: Pick<ContentStore, 'storedService' | 'storedSongs'>;
  readonly hasMedia: (id: string) => boolean;
}

/**
 * The open 예배 순서 as 진행 shows it, built from the current content. When a
 * change alters what 진행 shows, the next `ShowService` goes out one revision
 * higher; a change that doesn't alter it sends nothing.
 */
export class OpenServiceFeed {
  private revision = 0;
  private lastShown = JSON.stringify(null);
  private shown: ShowService | null = null;
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

  /** Builds it again and sends it when it changed. */
  refresh(): void {
    if (this.disposed) return;
    try {
      const next = this.build();
      const key = JSON.stringify(next);
      if (key !== this.lastShown) {
        this.lastShown = key;
        this.revision++;
        this.shown = next === null ? null : {...next, revision: this.revision};
        if (this.initialized) this.push(this.shown);
      }
      this.initialized = true;
    } catch (error: unknown) {
      this.reportError(error);
    }
  }

  dispose(): void {
    this.disposed = true;
  }

  private build(): ShowService | null {
    const {serviceId, labels, content, hasMedia} = this.sources;
    const service =
      serviceId === null ? undefined : content.storedService(serviceId);
    return service === undefined
      ? null
      : buildShowService({
          service,
          songs: content.storedSongs(),
          labels,
          revision: FIRST_REVISION,
          hasMedia,
        });
  }
}
