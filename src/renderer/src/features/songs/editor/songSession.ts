import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/ids';
import type {SongSlideSource} from '@core/schema/showService';
import {type Song} from '@core/schema/song';
import type {BlockCommand, BlockSelection} from '@core/songs/blockEdits';
import {SongHistory} from '@core/songs/songHistory';
import {SongTitleDraft} from '@core/songs/songTitle';

import {
  SongSessionPersistence,
  type SongDraftCapture,
  type EditorSongDocument,
} from './songSessionPersistence';
export type {EditorSongDocument} from './songSessionPersistence';

interface SessionOptions {
  readonly document: EditorSongDocument;
  readonly api: LlpApi['content'];
  readonly changed: () => void;
  readonly problem: () => void;
  readonly isDuplicateTitle?: (value: string) => boolean;
  readonly persistence?: 'automatic' | 'manual';
  /** True while the window's close preflight holds every edit. */
  readonly editingStopped?: () => boolean;
  readonly itemSession?: boolean;
}

/** Owns lyric history and drafts, borrowing its private persistence coordinator. */
export class SongSession {
  history: SongHistory;
  title: SongTitleDraft;
  background: MediaId | undefined;
  private dirty = false;
  private readonly persistence: SongSessionPersistence;
  private backgroundEdited = false;

  constructor(private readonly options: SessionOptions) {
    this.history = new SongHistory(options.document.song);
    this.title = new SongTitleDraft(
      options.document.song.title,
      options.isDuplicateTitle,
    );
    this.background = options.document.song.background;
    this.persistence = new SongSessionPersistence(options, {
      hasChanges: () => this.hasChanges,
      hasTitleDraft: () => this.title.hasDraft,
      hasDraft: () =>
        this.dirty || this.title.hasDraft || this.backgroundEdited,
      nextTitle: () => this.title.nextValue,
      endTyping: () => this.history.endTyping(),
      capture: document => this.captureDraft(document),
      reject: capture => {
        this.title.reject(capture.song.title);
        this.dirty ||= capture.lyricsDirty;
      },
      acknowledge: (document, capture) =>
        this.acknowledgeDraft(document, capture),
      install: document => this.installDraft(document),
      discard: document => {
        this.dirty = false;
        this.title = new SongTitleDraft(document.song.title);
        this.background = document.song.background;
        this.backgroundEdited = false;
      },
    });
  }

  get document(): EditorSongDocument {
    return this.persistence.document;
  }
  set document(document: EditorSongDocument) {
    this.persistence.document = document;
  }
  get blocked(): boolean {
    return this.persistence.blocked;
  }
  set blocked(blocked: boolean) {
    this.persistence.blocked = blocked;
  }

  get readOnly(): boolean {
    return this.blocked || this.document.access === 'readOnly';
  }

  get itemSession(): boolean {
    return this.options.itemSession === true;
  }

  get saving(): boolean {
    return this.persistence.saving;
  }

  /** Nothing unsaved or pending: dropping the session loses only its undo. */
  get clean(): boolean {
    return this.persistence.clean;
  }

  private get acceptsEdits(): boolean {
    return (
      this.persistence.acceptsEdits &&
      !this.readOnly &&
      this.options.editingStopped?.() !== true
    );
  }

  get selectedOccurrence(): number {
    return this.history.snapshot.selection.block;
  }
  selectOccurrence(index: number): void {
    this.select({block: index, start: 0, end: 0});
  }

  private get hasChanges(): boolean {
    return (
      this.dirty ||
      this.title.changed ||
      this.background !== this.document.song.background
    );
  }

  setBackground(id: MediaId | undefined): void {
    if (!this.acceptsEdits || this.background === id) return;
    this.background = id;
    this.backgroundEdited = true;
    this.endTyping();
    this.options.changed();
  }

  editTitle(value: string): void {
    if (!this.acceptsEdits || this.itemSession) return;
    this.title.edit(value);
    if (this.hasChanges || this.persistence.saving) this.persistence.schedule();
    else this.persistence.cancelSaveTimer();
    this.options.changed();
  }

  finishTitle(): void {
    if (this.options.persistence === 'manual') {
      this.endTyping();
      return;
    }
    this.title.revertInvalid();
    if (!this.persistence.saving && !this.blocked && !this.hasChanges) {
      if (this.persistence.incomingDocument !== undefined) {
        this.install(this.persistence.incomingDocument);
      } else this.title.accept(this.document.song.title, this.title.value);
    }
    this.endTyping();
    this.options.changed();
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

  /** Commits one slide key through the session's existing lock, history and save path. */
  setSlideHotKey(source: SongSlideSource, code: string | undefined): boolean {
    if (!this.acceptsEdits || !this.history.setSlideHotKey(source, code)) {
      return false;
    }
    this.dirty = true;
    this.endTyping();
    this.options.changed();
    return true;
  }

  edit(command: BlockCommand | 'undo' | 'redo'): void {
    if (!this.acceptsEdits) return;
    const previous = this.history.snapshot.song;
    if (command === 'undo') this.history.undo();
    else if (command === 'redo') this.history.redo();
    else {
      this.history.apply(command);
    }
    if (previous !== this.history.snapshot.song) {
      this.dirty = true;
      if (this.history.inTypingGroup) this.persistence.schedule();
      else this.endTyping();
    }
    this.options.changed();
  }

  /** Blur and block changes end both the undo group and its deferred save. */
  endTyping(): void {
    this.persistence.endTyping();
  }

  receive(document: EditorSongDocument): void {
    this.persistence.receive(document);
  }

  install(document: EditorSongDocument): void {
    this.persistence.install(document);
  }

  renamed(from: string, to: string, document?: EditorSongDocument): void {
    const baseline = this.document.song.slides.map(slide =>
      slide.label === from ? {...slide, label: to} : slide,
    );
    this.history.renameLabel(from, to);
    if (document !== undefined) {
      this.acceptGlobalEdit(document, baseline);
    }
    this.options.changed();
  }

  private acceptGlobalEdit(
    document: EditorSongDocument,
    baseline: Song['slides'],
  ): void {
    if (document.revision < this.document.revision) return;
    const current = this.history.snapshot.song;
    const sameStructure =
      JSON.stringify(document.song.slides) === JSON.stringify(current.slides);

    const onlyRenamed =
      JSON.stringify(document.song.slides) === JSON.stringify(baseline);
    if (!sameStructure && !onlyRenamed) {
      this.receive(document);
    } else {
      this.persistence.acceptBaseline(document);
      this.title.accept(document.song.title);
      if (!this.backgroundEdited) this.background = document.song.background;
    }
  }

  flush(): Promise<boolean> {
    return this.persistence.flush();
  }

  /** Edits not yet written: lyrics, 구성, title, or 배경 (the dot before the title). */
  get unsaved(): boolean {
    return this.persistence.unsaved;
  }

  /** Writes the edits now; a manual session writes only here. */
  async commit(): Promise<boolean> {
    this.endTyping();
    const written = await this.persistence.commit();
    if (!written) {
      this.dirty = true;
      this.blocked = false;
      this.options.changed();
    }
    return written;
  }

  close(): Promise<boolean> {
    return this.persistence.close();
  }

  discard(): void {
    this.persistence.discard();
  }

  /**
   * The whole song as the edits left it, under `title`. It changes nothing.
   */
  draftSong(
    title: string = this.title.nextValue,
    base: Song = this.document.song,
  ): Song {
    const {background: _draftBackground, ...draft} = this.history.snapshot.song;
    const {background: _oldBackground, ...baseSong} = base;
    return {
      ...baseSong,
      ...draft,
      title,
      slides: draft.slides,
      ...(this.background === undefined ? {} : {background: this.background}),
    };
  }

  private captureDraft(
    document: EditorSongDocument,
  ): SongDraftCapture | undefined {
    const song = this.draftSong(this.title.nextValue, document.song);
    const draft = this.history.snapshot.song;
    const lyricsDirty = this.dirty;
    this.dirty = false;
    const titleDraft =
      this.title.reason === undefined ? this.title.value : undefined;
    const background = this.background;

    return {song, draft, lyricsDirty, titleDraft, background};
  }

  private acknowledgeDraft(
    document: EditorSongDocument,
    capture: SongDraftCapture,
  ): void {
    const {titleDraft, background} = capture;
    this.title.accept(document.song.title, titleDraft);
    if (!this.backgroundEdited || this.background === background) {
      this.background = document.song.background;
      this.backgroundEdited = false;
    }
  }

  private installDraft(document: EditorSongDocument): void {
    this.history = new SongHistory(document.song);
    this.title = new SongTitleDraft(
      document.song.title,
      this.options.isDuplicateTitle,
    );
    this.background = document.song.background;
    this.backgroundEdited = false;
    this.dirty = false;
  }
}
