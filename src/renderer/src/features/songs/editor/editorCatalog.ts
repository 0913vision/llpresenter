import type {LibrarySong, SongChange} from '@core/schema/contentDocuments';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {
  EditorApi,
  EditorLabels,
  EditorOperationHost,
  EditorState,
} from './editorContracts';
import {editorTask} from './editorTask';
import type {SongSessionPool} from './songSessionPool';

/**
 * Live publication and deletion ports; the catalog never creates sessions.
 */
export interface EditorCatalogOptions {
  readonly api: EditorApi;
  readonly pool: SongSessionPool;
  readonly host: Pick<EditorOperationHost, 'alive' | 'publish' | 'problem'>;
  readonly songChanged: (change: SongChange) => void;
}

/**
 * Owns the existing labels/library reads and subscriptions with their revision
 * and generation guards. It publishes through the facade, without another UI
 * listener set, operation gate or session pool.
 */
export class EditorCatalog {
  private stops: ReadonlyArray<() => void> = [];
  private labels: EditorLabels | null = null;
  private library: readonly LibrarySong[] = [];
  private libraryStatus: EditorState['libraryStatus'] = 'loading';
  private libraryVersion = 0;

  constructor(private readonly context: EditorCatalogOptions) {}

  get labelsDocument(): EditorLabels | null {
    return this.labels;
  }
  get libraryEntries(): readonly LibrarySong[] {
    return this.library;
  }
  getSnapshot(): Pick<EditorState, 'labels' | 'library' | 'libraryStatus'> {
    return {
      labels: this.labels,
      library: this.library,
      libraryStatus: this.libraryStatus,
    };
  }

  /**
   * Registers feeds once, after the facade has installed every collaborator.
   */
  start(): void {
    const api = this.context.api;
    this.stops = [
      api.settings.subscribe(document => this.acceptLabels(document)),
      api.songs.subscribe(change => this.context.songChanged(change)),
      api.songs.subscribeList(entries => {
        this.libraryVersion++;
        this.acceptLibrary(entries);
      }),
    ];
    editorTask(this.readLabels());
    editorTask(this.readLibrary());
  }

  dispose(): void {
    for (const stop of this.stops) stop();
  }

  async readLabels(): Promise<void> {
    try {
      this.acceptLabels(await this.context.api.settings.get({name: 'labels'}));
    } catch {
      this.context.host.problem('이름표 불러오기 실패', () =>
        this.readLabels(),
      );
    }
  }

  private async readLibrary(): Promise<void> {
    const version = ++this.libraryVersion;
    this.libraryStatus = 'loading';
    this.context.host.publish();
    try {
      const entries = await this.context.api.songs.list();
      if (this.context.host.alive() && version === this.libraryVersion) {
        this.acceptLibrary(entries);
      }
    } catch {
      if (!this.context.host.alive() || version !== this.libraryVersion) {
        return;
      }
      this.libraryStatus = 'failed';
      this.context.host.publish();
      this.context.host.problem('곡 목록 불러오기 실패', () =>
        this.readLibrary(),
      );
    }
  }

  private acceptLibrary(entries: readonly LibrarySong[]): void {
    if (!this.context.host.alive()) return;
    this.library = entries;
    this.libraryStatus = 'ready';
    const ids = new Set(entries.map(entry => entry.id));
    for (const id of this.context.pool.keys()) {
      if (!ids.has(id)) this.context.pool.remove(id);
    }
    this.context.host.publish();
  }

  private acceptLabels(document: SettingsDocument): void {
    if (
      this.context.host.alive() &&
      document.name === 'labels' &&
      (this.labels === null || document.revision > this.labels.revision)
    ) {
      this.labels = document;
      this.context.host.publish();
    }
  }
}
