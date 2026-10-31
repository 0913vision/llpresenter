import type {SongDocument} from '@core/schema/contentDocuments';
import type {ContentEdit} from '@core/schema/contentEdit';
import type {SongId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import type {TextImportDraft} from '@core/schema/textImport';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {EditorCatalog} from './editorCatalog';
import type {
  AppliedRename,
  EditorActionRequest,
  EditorApi,
  EditorOperationHost,
  EditorState,
  RenameApplied,
  SongEditorAction,
} from './editorContracts';
import {EditorSharedEdits} from './editorSharedEdits';
import {ImportedSongDraft} from './importedSongDraft';
import type {SongSession} from './songSession';
import {SongSessionPool} from './songSessionPool';
export type {
  AppliedRename,
  EditorActionRequest,
  EditorApi,
  EditorLabels,
  SongEditorAction,
} from './editorContracts';

/** One control window's editor sessions. The host disposes it at window close. */
export class SongEditorStore {
  private readonly pool: SongSessionPool;
  private readonly catalog: EditorCatalog;
  private readonly importedDraft: ImportedSongDraft;
  private readonly sharedEdits: EditorSharedEdits;

  private readonly listeners = new Set<() => void>();
  private busy = false;
  private editingStopped = false;
  private alive = true;
  private operation: Promise<boolean> | undefined;
  private focusSerial = 0;
  private titleFocus = 0;
  private actionRequest: EditorActionRequest | null = null;
  private actionSerial = 0;
  private state: EditorState = {
    actionRequest: null,
    session: null,
    labels: null,
    busy: false,
    library: [],
    libraryStatus: 'loading',
    titleFocus: 0,
    imported: false,
    discardRequested: false,
  };

  constructor(
    readonly api: EditorApi,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    const host: EditorOperationHost = {
      alive: () => this.alive,
      locked: () => this.locked,
      runOperation: task => this.runOperation(task),
      publish: () => this.publish(),
      problem: (title, retry) => this.problem(title, retry),
    };
    this.pool = new SongSessionPool({
      api,
      host,
      library: () => this.catalog.libraryEntries,
      busy: () => this.busy,
      editingStopped: () => this.editingStopped,
    });
    this.catalog = new EditorCatalog({
      api,
      pool: this.pool,
      host,
      songChanged: change => this.sharedEdits.receive(change),
    });
    this.importedDraft = new ImportedSongDraft({
      api,
      pool: this.pool,
      host,
      library: () => this.catalog.libraryEntries,
      clearActionRequest: () => {
        this.actionRequest = null;
      },
      focusTitle: () => {
        this.titleFocus = ++this.focusSerial;
      },
      open: document => this.open(document),
    });
    this.sharedEdits = new EditorSharedEdits({
      api,
      pool: this.pool,
      catalog: this.catalog,
      imported: () => this.importedDraft.session,
      host,
    });
    this.catalog.start();
  }

  readonly getSnapshot = (): EditorState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Opens a checked source; forward the library's focusTitle after creation. */
  open(
    document: SongDocument | null,
    options: {
      readonly focusTitle?: boolean;
      readonly block?: number;
      readonly arrangement?: string | undefined;
      readonly action?: SongEditorAction | undefined;
    } = {},
  ): void {
    if (!this.alive) return;
    if (this.importedDraft.session !== null) {
      this.requestLeave(() => this.open(document, options));
      return;
    }
    if (
      this.pool.editorSongId !== null &&
      this.pool.editorSongId !== document?.song.id
    ) {
      this.pool.get(this.pool.editorSongId)?.endTyping();
    }
    this.pool.pinEditor(document?.song.id ?? null);
    this.titleFocus =
      document !== null && options.focusTitle === true ? ++this.focusSerial : 0;
    this.actionRequest = null;
    if (document !== null) {
      const session = this.pool.attach(document);
      if (options.block !== undefined) {
        session.selectArrangement(options.arrangement);
        session.select({block: options.block, start: 0, end: 0});
      }
      if (options.action !== undefined) {
        this.actionRequest = {
          action: options.action,
          serial: ++this.actionSerial,
          arrangement: session.arrangement,
        };
      }
    }
    this.publish();
  }

  requestAction(action: SongEditorAction | null): void {
    if (!this.alive) return;
    this.actionRequest =
      action === null
        ? null
        : {
            action,
            serial: ++this.actionSerial,
            arrangement: this.state.session?.arrangement,
          };
    this.publish();
  }

  openImported(draft: TextImportDraft): void {
    this.importedDraft.openImported(draft);
  }

  requestLeave(action: () => void): void {
    this.importedDraft.requestLeave(action);
  }

  cancelDiscard(): void {
    this.importedDraft.cancelDiscard();
  }

  reportImportReadFailure(): void {
    this.importedDraft.reportImportReadFailure();
  }

  reportImportTargetChanged(): void {
    this.importedDraft.reportImportTargetChanged();
  }

  discardImported(): void {
    this.importedDraft.discardImported();
  }

  saveImported(
    target: Extract<ContentEdit, {type: 'song.import'}>['target'],
  ): Promise<boolean> {
    return this.importedDraft.saveImported(target);
  }

  /**
   * Gives the song's session without opening it in the editor, so a 예배 순서
   * item edits its 구성 through the same writer as the editor.
   */
  attach(document: SongDocument): SongSession | undefined {
    if (!this.alive) return undefined;
    const session = this.pool.attach(document);
    this.publish();
    return session;
  }

  sessionOf(id: SongId): SongSession | undefined {
    return this.pool.get(id);
  }

  /**
   * Names the song the 예배 순서 item panel shows, or none. Like the song open
   * in the editor, its session is never evicted.
   */
  showItemSong(id: SongId | null): void {
    this.pool.showItemSong(id);
  }

  /** Claims a new-song focus request once, including across panel remounts. */
  consumeTitleFocus(request: number): boolean {
    if (request === 0 || request !== this.titleFocus) return false;
    this.titleFocus = 0;
    this.publish();
    return true;
  }

  updateLabels(labels: readonly Label[]): Promise<boolean> {
    return this.sharedEdits.updateLabels(labels);
  }

  renameLabel(
    from: string,
    to: string,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    return this.sharedEdits.renameLabel(from, to, onApplied);
  }

  renameArrangement(
    from: string,
    to: string,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    return this.sharedEdits.renameArrangement(from, to, onApplied);
  }

  deleteArrangement(name: string): Promise<boolean> {
    return this.sharedEdits.deleteArrangement(name);
  }

  /** Persists an applied identity without replaying its rename or its reference rewrites. */
  retryRename(identity: AppliedRename): Promise<boolean> {
    return this.sharedEdits.retryRename(identity);
  }

  /**
   * Preflight shutdown before unmounting. Every edit stops first, so nothing
   * typed during or after the flush can be lost. A 구성 or 이름표 change that
   * is still running must go through too. False keeps a refused draft and
   * restarts editing; after true, editing stays stopped until the window
   * closes or {@link resume}.
   */
  async flush(): Promise<boolean> {
    this.stopEditing(true);
    let flushed = false;
    try {
      const operationDone = (await this.operation) ?? true;
      const results = await this.pool.flushAll();
      flushed =
        operationDone &&
        results.every(Boolean) &&
        this.importedDraft.session === null;
      return flushed;
    } finally {
      if (!flushed) this.stopEditing(false);
    }
  }

  /** Restarts editing when the window's close was refused elsewhere. */
  resume(): void {
    this.stopEditing(false);
  }

  async dispose(): Promise<void> {
    this.alive = false;
    this.catalog.dispose();
    await this.operation;
    await this.pool.closeAll();
    this.pool.clear();
    this.importedDraft.dispose();
    this.sharedEdits.clearBuffered();
    this.listeners.clear();
  }

  private get locked(): boolean {
    return this.busy || this.editingStopped;
  }

  private stopEditing(stopped: boolean): void {
    if (this.editingStopped === stopped) return;
    this.editingStopped = stopped;
    this.publish();
  }

  private runOperation(task: () => Promise<boolean>): Promise<boolean> {
    this.busy = true;
    this.publish();
    this.operation = task().finally(() => {
      this.sharedEdits.finishOperation();
      this.busy = false;
      this.operation = undefined;
      this.pool.evict();
      this.publish();
    });
    return this.operation;
  }

  private problem(title: string, retry?: () => unknown): void {
    if (this.alive) {
      this.onProblem({
        key: `editor:${this.pool.editorSongId}:${title}`,
        kind: 'warning',
        icon: 'warning',
        title,
        time: noticeTime(),
        ...(retry === undefined
          ? {}
          : {
              actions: [
                {icon: 'refresh', label: '다시 불러오기', onSelect: retry},
              ],
            }),
      });
    }
  }

  private publish(): void {
    if (!this.alive) return;
    const catalog = this.catalog.getSnapshot();
    this.state = {
      actionRequest: this.actionRequest,
      session:
        this.importedDraft.session ??
        (this.pool.editorSongId === null
          ? null
          : (this.pool.get(this.pool.editorSongId) ?? null)),
      labels: catalog.labels,
      busy: this.locked,
      library: catalog.library,
      libraryStatus: catalog.libraryStatus,
      titleFocus: this.titleFocus,
      imported: this.importedDraft.session !== null,
      discardRequested: this.importedDraft.discardRequested,
    };
    for (const listener of this.listeners) listener();
  }
}
