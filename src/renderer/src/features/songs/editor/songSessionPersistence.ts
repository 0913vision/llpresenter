import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/ids';
import type {AnySong, GroupedSong} from '@core/schema/groupedSong';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import {normalizeSongTitle} from '@core/songs/songTitle';
import {editorTask} from './editorTask';

export interface EditorSongDocument<S extends AnySong = GroupedSong> {
  readonly song: S;
  readonly revision: number;
  readonly access: 'editable' | 'readOnly';
}

/** Captures the submitted draft without replacing edits made during its write. */
export interface SongDraftCapture<S extends AnySong = GroupedSong> {
  readonly song: GroupedSong;
  readonly draft: S;
  readonly lyricsDirty: boolean;
  readonly titleDraft: string | undefined;
  readonly background: MediaId | undefined;
}

/** Borrows the session's only history and drafts for its private writer. */
export interface SongDraftPort<S extends AnySong = GroupedSong> {
  hasChanges(): boolean;
  hasTitleDraft(): boolean;
  hasDraft(): boolean;
  nextTitle(): string;
  endTyping(): void;
  capture(document: EditorSongDocument<S>): SongDraftCapture<S> | undefined;
  reject(capture: SongDraftCapture<S>): void;
  acknowledge(
    document: EditorSongDocument<S>,
    capture: SongDraftCapture<S>,
  ): void;
  install(document: EditorSongDocument<S>): void;
  discard(document: EditorSongDocument<S>): void;
}

interface PersistenceOptions<S extends AnySong> {
  readonly document: EditorSongDocument<S>;
  readonly api: LlpApi['content'];
  readonly changed: () => void;
  readonly problem: () => void;
  readonly persistence?: 'automatic' | 'manual';
}

/** Owns one session's typing timer, revision reconciliation and single-flight saves. */
export class SongSessionPersistence<S extends AnySong = GroupedSong> {
  document: EditorSongDocument<S>;
  blocked = false;
  private writing = false;
  private accepting = true;
  private pending: Promise<boolean> | undefined;
  private incoming: EditorSongDocument<S> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly options: PersistenceOptions<S>,
    private readonly draft: SongDraftPort<S>,
  ) {
    this.document = options.document;
  }

  get saving(): boolean {
    return this.writing;
  }
  get acceptsEdits(): boolean {
    return this.accepting;
  }
  get incomingDocument(): EditorSongDocument<S> | undefined {
    return this.incoming;
  }
  /** Whether edits wait for an explicit {@link commit}. */
  get manual(): boolean {
    return this.options.persistence === 'manual';
  }
  get unsaved(): boolean {
    return this.draft.hasChanges() || this.draft.hasTitleDraft();
  }
  get clean(): boolean {
    return (
      !this.draft.hasChanges() &&
      !this.draft.hasTitleDraft() &&
      !this.writing &&
      !this.blocked &&
      this.saveTimer === undefined
    );
  }

  endTyping(): void {
    this.draft.endTyping();
    this.cancelSaveTimer();
    if (!this.writing) editorTask(this.save());
  }

  receive(document: EditorSongDocument<S>): void {
    if (document.revision <= this.document.revision) return;
    if (this.draft.hasDraft() || this.writing || this.blocked) {
      if (document.revision > (this.incoming?.revision ?? 0)) {
        this.incoming = document;
      }
    } else this.install(document);
  }

  install(document: EditorSongDocument<S>): void {
    this.cancelSaveTimer();
    this.document = document;
    this.draft.install(document);
    this.blocked = false;
    this.incoming = undefined;
    this.options.changed();
  }

  async flush(): Promise<boolean> {
    if (this.options.persistence === 'manual') return true;
    do {
      this.cancelSaveTimer();
      if (!(await this.save())) return false;
    } while (this.draft.hasChanges());
    return true;
  }

  /** Writes the edits now, also in manual mode. */
  commit(): Promise<boolean> {
    this.cancelSaveTimer();
    return this.save(true);
  }

  close(): Promise<boolean> {
    this.accepting = false;
    return this.flush();
  }

  discard(): void {
    this.cancelSaveTimer();
    this.accepting = false;
    this.draft.discard(this.document);
  }

  schedule(): void {
    if (this.options.persistence === 'manual') return;
    this.cancelSaveTimer();
    this.saveTimer = setTimeout(() => this.endTyping(), TYPING_PAUSE_MS);
  }

  cancelSaveTimer(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
  }

  private save(explicit = false): Promise<boolean> {
    if (this.manual && !explicit) return Promise.resolve(true);
    if (this.pending !== undefined) return this.pending;
    if (!this.draft.hasChanges() || this.blocked) {
      return Promise.resolve(!this.blocked);
    }
    this.writing = true;
    this.pending = this.drain().finally(() => {
      this.writing = false;
      this.pending = undefined;
      this.options.changed();
    });
    return this.pending;
  }

  private async drain(): Promise<boolean> {
    while (
      this.draft.hasChanges() &&
      !this.blocked &&
      this.saveTimer === undefined
    ) {
      const capture = this.draft.capture(this.document);
      if (capture === undefined) return this.fail();
      const {song, draft, background} = capture;
      try {
        const result = await this.options.api.edit({
          type: 'song.update',
          song,
          baseRevision: this.document.revision,
        });
        if (
          !result.ok &&
          result.error.reason === 'duplicate-title' &&
          song.title !== normalizeSongTitle(this.document.song.title)
        ) {
          this.draft.reject(capture);
          this.options.changed();
          continue;
        }
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
            : {
                ...this.document,
                song: {
                  ...this.document.song,
                  ...draft,
                  title: this.draft.nextTitle(),
                  ...(background === undefined ? {} : {background}),
                },
                revision: applied.revision,
              };
        this.incoming = undefined;
        this.draft.acknowledge(this.document, capture);
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
