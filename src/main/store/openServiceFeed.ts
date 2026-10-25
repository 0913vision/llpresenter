import type {Label} from '@shared/schema/labels';
import type {ShowService} from '@shared/schema/showService';
import type {ContentStore} from './contentStore';
import {buildShowService} from './showService';

const FIRST_REVISION = 1;

export interface OpenServiceSources {
  /** The 예배 순서 that 진행 opened, or `null` for none. */
  readonly serviceId: string | null;
  readonly labels: readonly Label[];
  readonly content: Pick<ContentStore, 'storedService' | 'storedSongs'>;
}

/**
 * The open 예배 순서 as 진행 shows it, built from the current content. When a
 * change alters what 진행 shows, such as a song's lyrics or the item order,
 * the next `ShowService` goes out one revision higher; a change that doesn't
 * alter it sends nothing.
 */
export class OpenServiceFeed {
  private revision = FIRST_REVISION;
  private lastShown: string;
  private shown: ShowService | null;

  constructor(
    private readonly sources: OpenServiceSources,
    private readonly push: (service: ShowService | null) => void,
    private readonly reportError: (error: unknown) => void,
  ) {
    this.shown = this.build(FIRST_REVISION);
    this.lastShown = JSON.stringify(this.shown);
  }

  current(): ShowService | null {
    return this.shown;
  }

  /** Sends the open 예배 순서 again when what 진행 shows changed. */
  refresh(): void {
    try {
      const next = this.build(FIRST_REVISION);
      const key = JSON.stringify(next);
      if (key === this.lastShown) {
        return;
      }
      this.lastShown = key;
      this.revision++;
      this.shown = next === null ? null : {...next, revision: this.revision};
      this.push(this.shown);
    } catch (error: unknown) {
      this.reportError(error);
    }
  }

  private build(revision: number): ShowService | null {
    const {serviceId, labels, content} = this.sources;
    const service =
      serviceId === null ? undefined : content.storedService(serviceId);
    if (service === undefined) {
      return null;
    }
    return buildShowService({
      service,
      songs: content.storedSongs(),
      labels,
      revision,
    });
  }
}
