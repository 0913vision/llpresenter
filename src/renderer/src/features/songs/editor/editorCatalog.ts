import type {LibrarySong, SongChange} from '@core/schema/contentDocuments';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {LabelColor} from '@core/labels/colors';
import type {LabelColorPreview} from '@core/schema/labelColorPreview';
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
  private labelsStatus: 'loading' | 'ready' | 'failed' = 'loading';
  private preview: LabelColorPreview | null = null;
  private displayedLabels: EditorLabels | null = null;
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
  getSnapshot(): Pick<EditorState, 'labels' | 'library' | 'libraryStatus'> & {
    readonly labelsStatus: NonNullable<EditorState['labelsStatus']>;
  } {
    return {
      labels: this.displayedLabels,
      labelsStatus: this.labelsStatus,
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
      api.settings.subscribeLabelColorPreview(preview => {
        this.preview = preview;
        this.publishLabels();
      }),
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

  previewLabelColor(name: string, color: LabelColor | null): void {
    this.preview = color === null ? null : {name, color};
    this.publishLabels();
    editorTask(this.context.api.settings.previewLabelColor({name, color}));
  }

  private publishLabels(): void {
    const preview = this.preview;
    this.displayedLabels =
      this.labels === null || preview === null
        ? this.labels
        : {
            ...this.labels,
            value: {
              ...this.labels.value,
              labels: this.labels.value.labels.map(label =>
                label.name === preview.name
                  ? {...label, color: preview.color}
                  : label,
              ),
            },
          };
    this.context.host.publish();
  }

  async readLabels(): Promise<void> {
    try {
      this.acceptLabels(await this.context.api.settings.get({name: 'labels'}));
    } catch {
      if (!this.context.host.alive()) return;
      this.labelsStatus = 'failed';
      this.context.host.publish();
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
      if (this.context.pool.get(id)?.itemSession === true) continue;
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
      this.labelsStatus = 'ready';
      this.preview = null;
      this.publishLabels();
    }
  }
}
