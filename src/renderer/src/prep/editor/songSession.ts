import type {LlpApi} from '@shared/ipc';
import type {SongDocument} from '@shared/schema/contentDocuments';
import type {BlockCommand, BlockSelection} from './blockEdits';
import {SongHistory, TYPING_PAUSE_MS} from './songHistory';
import {editorTask} from './editorTask';

interface SessionOptions {
  readonly document: SongDocument;
  readonly api: LlpApi['content'];
  readonly changed: () => void;
  readonly problem: () => void;
}

/** Coalesces typing-group saves and serializes one song's pending writes. */
export class SongSession {
  document: SongDocument;
  history: SongHistory;
  blocked = false;
  private dirty = false;
  private writing = false;
  private accepting = true;
  private pending: Promise<boolean> | undefined;
  private incoming: SongDocument | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: SessionOptions) {
    this.document = options.document;
    this.history = new SongHistory(options.document.song);
  }

  get readOnly(): boolean {
    return this.blocked || this.document.access === 'readOnly';
  }
  get saving(): boolean {
    return this.writing;
  }

  select(selection: BlockSelection): void {
    const current = this.history.snapshot.selection;
    if (
      current.block === selection.block &&
      current.start === selection.start &&
      current.end === selection.end
    ) {
      return;
    }
    if (current.block !== selection.block) this.endTyping();
    this.history.select(selection);
    this.options.changed();
  }

  edit(command: BlockCommand | 'undo' | 'redo'): void {
    if (!this.accepting || this.readOnly) return;
    const previous = this.history.snapshot.song;
    if (command === 'undo') this.history.undo();
    else if (command === 'redo') this.history.redo();
    else this.history.apply(command);
    if (previous !== this.history.snapshot.song) {
      this.dirty = true;
      if (this.history.inTypingGroup) this.delaySave();
      else this.endTyping();
    }
    this.options.changed();
  }

  /** Blur and block changes end both the undo group and its deferred save. */
  endTyping(): void {
    this.history.endTyping();
    this.cancelSaveTimer();
    if (!this.writing) editorTask(this.save());
  }

  receive(document: SongDocument): void {
    if (document.revision <= this.document.revision) return;
    if (this.dirty || this.writing || this.blocked) {
      if (document.revision > (this.incoming?.revision ?? 0)) {
        this.incoming = document;
      }
    } else this.install(document);
  }

  install(document: SongDocument): void {
    this.cancelSaveTimer();
    this.document = document;
    this.history = new SongHistory(document.song);
    this.blocked = false;
    this.dirty = false;
    this.incoming = undefined;
    this.options.changed();
  }

  renamed(from: string, to: string, document?: SongDocument): void {
    this.history.renameLabel(from, to);
    if (document !== undefined) {
      if (
        JSON.stringify(document.song.slides) !==
          JSON.stringify(this.history.snapshot.song.slides) ||
        JSON.stringify(document.song.arrangements) !==
          JSON.stringify(this.history.snapshot.song.arrangements)
      ) {
        this.install(document);
      } else this.document = document;
    }
    this.options.changed();
  }

  async flush(): Promise<boolean> {
    do {
      this.cancelSaveTimer();
      if (!(await this.save())) return false;
    } while (this.dirty);
    return true;
  }

  close(): Promise<boolean> {
    this.accepting = false;
    return this.flush();
  }

  discard(): void {
    this.cancelSaveTimer();
    this.accepting = false;
    this.dirty = false;
  }

  private delaySave(): void {
    this.cancelSaveTimer();
    this.saveTimer = setTimeout(() => this.endTyping(), TYPING_PAUSE_MS);
  }

  private cancelSaveTimer(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
  }

  private save(): Promise<boolean> {
    if (this.pending !== undefined) return this.pending;
    if (!this.dirty || this.blocked) return Promise.resolve(!this.blocked);
    this.writing = true;
    this.pending = this.drain().finally(() => {
      this.writing = false;
      this.pending = undefined;
      this.options.changed();
    });
    return this.pending;
  }

  private async drain(): Promise<boolean> {
    while (this.dirty && !this.blocked && this.saveTimer === undefined) {
      this.dirty = false;
      const draft = this.history.snapshot.song;
      const song = {
        ...draft,
        ...this.document.song,
        slides: draft.slides,
        ...(draft.arrangements === undefined
          ? {}
          : {arrangements: draft.arrangements}),
      };
      try {
        const result = await this.options.api.edit({
          type: 'song.update',
          song,
          baseRevision: this.document.revision,
        });
        const applied = result.ok
          ? result.value
          : result.error.reason === 'write-failed'
            ? result.error.applied
            : undefined;
        if (applied?.revision === undefined || applied.revision === null) {
          return this.fail();
        }
        if (
          this.incoming !== undefined &&
          this.incoming.revision > applied.revision
        ) {
          return this.fail();
        }
        this.document =
          this.incoming?.revision === applied.revision
            ? this.incoming
            : {...this.document, song, revision: applied.revision};
        this.incoming = undefined;
        if (!result.ok) this.options.problem();
      } catch {
        return this.fail();
      }
    }
    return true;
  }

  private fail(): false {
    this.cancelSaveTimer();
    this.blocked = true;
    this.options.problem();
    return false;
  }
}
