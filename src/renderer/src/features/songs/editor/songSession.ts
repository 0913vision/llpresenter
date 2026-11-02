import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId, SongGroupId} from '@core/schema/ids';
import type {SongSlideSource} from '@core/schema/showService';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {arrangementGroupIds, type GroupedSong} from '@core/schema/groupedSong';
import type {BlockCommand, BlockSelection} from '@core/songs/blockEdits';
import {SongHistory} from '@core/songs/songHistory';
import {SongTitleDraft} from '@core/songs/songTitle';
import {editedOrderWithLimit} from '@core/songs/songArrangements';

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
  readonly backspaceRefused?: (block: number) => void;
}

/** Owns lyric history and drafts, borrowing its private persistence coordinator. */
export class SongSession {
  history: SongHistory;
  title: SongTitleDraft;
  background: MediaId | undefined;
  private dirty = false;
  private readonly persistence: SongSessionPersistence;
  private backgroundEdited = false;
  private pickedArrangement: string | undefined;
  private pointedSlide: {order: string | undefined; index: number} | null =
    null;
  private readonly backspaceRefusedListeners = new Set<
    (block: number) => void
  >();

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

  get arrangement(): string | undefined {
    return this.pickedArrangement;
  }

  get arrangementGroups(): readonly SongGroupId[] {
    return arrangementGroupIds(this.history.snapshot.song, this.arrangement);
  }

  get arrangementSlides(): readonly number[] {
    return this.arrangementOrder.slides;
  }

  get arrangementOrder() {
    return editedOrderWithLimit(this.history.snapshot.song, this.arrangement);
  }

  /** The selected occurrence in the active order, or -1 outside that order. */
  get selectedOccurrence(): number {
    const numbers = this.arrangementOrder.slides;
    const block = this.history.snapshot.selection.block;
    const pointed = this.pointedSlide;
    return pointed !== null &&
      pointed.order === this.arrangement &&
      numbers[pointed.index] === block + 1
      ? pointed.index
      : numbers.indexOf(block + 1);
  }

  /** Shares thumbnail occurrence selection without adding it to lyric history. */
  selectOccurrence(index: number): void {
    const number = this.arrangementOrder.slides[index];
    if (number === undefined) return;
    this.pointedSlide = {order: this.arrangement, index};
    const previous = this.history.snapshot.selection;
    this.select({block: number - 1, start: 0, end: 0});
    if (this.history.snapshot.selection === previous) this.options.changed();
  }

  onBackspaceRefused(listener: (block: number) => void): () => void {
    this.backspaceRefusedListeners.add(listener);
    return () => {
      this.backspaceRefusedListeners.delete(listener);
    };
  }

  notifyBackspaceRefused(block: number): void {
    this.options.backspaceRefused?.(block);
    for (const listener of this.backspaceRefusedListeners) {
      listener(block);
    }
  }

  /** Changes the viewed order and ends typing without moving the lyric cursor. */
  selectArrangement(name: string | undefined): void {
    if (name === this.arrangement) return;
    if (
      name !== undefined &&
      !this.history.snapshot.song.arrangements?.some(item => item.name === name)
    ) {
      return;
    }
    this.endTyping();
    this.pickedArrangement = name;
    this.options.changed();
  }

  /** Creates a discrete undo step and saves it with any pending lyric draft. */
  createArrangement(requestedName?: string): string | undefined {
    const name = this.copyArrangement(this.arrangement, requestedName);
    if (name !== undefined) {
      this.pickedArrangement = name;
      this.options.changed();
    }
    return name;
  }

  /**
   * Adds a numbered 구성 that copies the order of `base` (기본 with
   * `undefined`) as one undo step, without changing the editor's view.
   */
  copyArrangement(
    base: string | undefined,
    requestedName?: string,
  ): string | undefined {
    if (!this.acceptsEdits) return undefined;
    const song = this.history.snapshot.song;
    if (
      requestedName !== undefined &&
      (requestedName.trim() === '' ||
        requestedName === DEFAULT_ARRANGEMENT_NAME ||
        song.arrangements?.some(item => item.name === requestedName))
    ) {
      return undefined;
    }
    const names = new Set(song.arrangements?.map(({name}) => name));
    let number = 1;
    while (names.has(`구성 ${number}`)) number++;
    const name = requestedName ?? `구성 ${number}`;
    const groups = [...arrangementGroupIds(song, base)];
    this.history.setArrangementGroups(name, groups);
    this.dirty = true;
    this.endTyping();
    this.options.changed();
    return name;
  }

  /**
   * Saves a named 구성's new group order as one undo step.
   */
  setArrangementGroups(name: string, groups: readonly SongGroupId[]): boolean {
    if (!this.acceptsEdits) return false;
    const song = this.history.snapshot.song;
    const ids = new Set(song.groups.map(group => group.id));
    if (!groups.every(id => ids.has(id))) return false;
    if (!this.history.setArrangementGroups(name, groups)) return false;
    this.dirty = true;
    this.endTyping();
    this.options.changed();
    return true;
  }

  private reconcileArrangement(): void {
    if (
      !this.history.snapshot.song.arrangements?.some(
        item => item.name === this.arrangement,
      )
    ) {
      this.pickedArrangement = undefined;
    }
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
    if (!this.acceptsEdits) return;
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
      const next = this.history.apply(command);
      if (next.mergeRefused) {
        this.notifyBackspaceRefused(next.selection.block);
      }
    }
    this.reconcileArrangement();
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
    this.history.renameLabel(from, to);
    if (document !== undefined) {
      this.acceptGlobalEdit(document);
    }
    this.options.changed();
  }

  /** Applies main's global rename/delete to every local history snapshot. */
  arrangementChanged(
    from: string,
    to: string | undefined,
    document?: EditorSongDocument,
  ): void {
    this.history.changeArrangement(from, to);
    if (this.pickedArrangement === from) this.pickedArrangement = to;
    if (document !== undefined) this.acceptGlobalEdit(document);
    this.options.changed();
  }

  private acceptGlobalEdit(document: EditorSongDocument): void {
    const current = this.history.snapshot.song;
    const sameStructure =
      JSON.stringify(document.song.groups) === JSON.stringify(current.groups) &&
      JSON.stringify(document.song.arrangements) ===
        JSON.stringify(current.arrangements);

    if (!sameStructure) {
      this.install(document);
    } else {
      this.document = document;
      this.title.accept(document.song.title);
      if (!this.backgroundEdited) this.background = document.song.background;
      this.reconcileArrangement();
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
    base: GroupedSong = this.document.song,
  ): GroupedSong {
    const draft = this.history.snapshot.song;
    const {
      background: _oldBackground,
      arrangements: _oldArrangements,
      ...baseSong
    } = base;
    return {
      ...baseSong,
      ...draft,
      title,
      groups: draft.groups,
      ...(draft.arrangements === undefined
        ? {}
        : {arrangements: draft.arrangements}),
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
    this.reconcileArrangement();
    this.title = new SongTitleDraft(
      document.song.title,
      this.options.isDuplicateTitle,
    );
    this.background = document.song.background;
    this.backgroundEdited = false;
    this.dirty = false;
  }
}
