import type {LlpApi} from '@shared/ipc';
import type {MediaId, SongGroupId} from '@shared/schema/ids';
import type {Song} from '@shared/schema/song';
import {
  isGroupedSong,
  type AnySong,
  type BlockCommand,
  type BlockSelection,
} from './blockEdits';
import {SongHistory, TYPING_PAUSE_MS} from './songHistory';
import {editorTask} from './editorTask';
import {normalizeSongTitle, SongTitleDraft} from './songTitle';
import {editedOrder, newArrangement} from './songArrangements';

export interface EditorSongDocument<S extends AnySong = Song> {
  readonly song: S;
  readonly revision: number;
  readonly access: 'editable' | 'readOnly';
}

interface SessionOptions<S extends AnySong = Song> {
  readonly document: EditorSongDocument<S>;
  readonly api: LlpApi['content'];
  readonly changed: () => void;
  readonly problem: () => void;
  readonly isDuplicateTitle?: (value: string) => boolean;
  readonly persistence?: 'automatic' | 'manual';
  /** True while the window's close preflight holds every edit. */
  readonly editingStopped?: () => boolean;
  readonly backspaceRefused?: (block: number) => void;
}

/** Coalesces typing-group saves and serializes one song's pending writes. */
export class SongSession<S extends AnySong = Song> {
  document: EditorSongDocument<S>;
  history: SongHistory<S>;
  title: SongTitleDraft;
  background: MediaId | undefined;
  blocked = false;
  private dirty = false;
  private writing = false;
  private accepting = true;
  private pending: Promise<boolean> | undefined;
  private incoming: EditorSongDocument<S> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private backgroundEdited = false;
  private pickedArrangement: string | undefined;
  private readonly backspaceRefusedListeners = new Set<
    (block: number) => void
  >();

  constructor(private readonly options: SessionOptions<S>) {
    this.document = options.document;
    this.history = new SongHistory(options.document.song);
    this.title = new SongTitleDraft(
      options.document.song.title,
      options.isDuplicateTitle,
    );
    this.background = options.document.song.background;
  }

  get readOnly(): boolean {
    return this.blocked || this.document.access === 'readOnly';
  }
  get saving(): boolean {
    return this.writing;
  }

  /** Nothing unsaved or pending: dropping the session loses only its undo. */
  get clean(): boolean {
    return (
      !this.hasChanges &&
      !this.title.hasDraft &&
      !this.writing &&
      !this.blocked &&
      this.saveTimer === undefined
    );
  }

  private get acceptsEdits(): boolean {
    return (
      this.accepting &&
      !this.readOnly &&
      this.options.editingStopped?.() !== true
    );
  }

  get arrangement(): string | undefined {
    return this.pickedArrangement;
  }

  get arrangementGroups(): readonly SongGroupId[] | undefined {
    const song = this.history.snapshot.song;
    if (!isGroupedSong(song)) return undefined;
    const chosen =
      this.arrangement === undefined
        ? undefined
        : song.arrangements?.find(item => item.name === this.arrangement);
    if (chosen !== undefined) return chosen.groups;
    return song.groups.map(g => g.id);
  }

  get arrangementSlides(): readonly number[] {
    const song = this.history.snapshot.song;
    if (isGroupedSong(song)) {
      const chosen =
        this.arrangement === undefined
          ? undefined
          : song.arrangements?.find(item => item.name === this.arrangement);
      const groupIds =
        chosen !== undefined && chosen.groups.length > 0
          ? chosen.groups
          : song.groups.map(g => g.id);
      const groupOffset = new Map<string, number>();
      let offset = 1;
      for (const group of song.groups) {
        groupOffset.set(group.id, offset);
        offset += group.slides.length;
      }
      const groupsById = new Map(song.groups.map(g => [g.id, g]));
      const result: number[] = [];
      for (const id of groupIds) {
        const group = groupsById.get(id);
        const start = groupOffset.get(id);
        if (group === undefined || start === undefined) continue;
        for (let i = 0; i < group.slides.length; i++) {
          result.push(start + i);
        }
      }
      return result;
    }
    return editedOrder(song, this.arrangement);
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
  createArrangement(): string | undefined {
    const name = this.copyArrangement(this.arrangement);
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
  copyArrangement(base: string | undefined): string | undefined {
    if (!this.acceptsEdits) return undefined;
    const song = this.history.snapshot.song;
    if (isGroupedSong(song)) {
      // NOTE(0913vision): Grouped song arrangement creation.
      const names = new Set(song.arrangements?.map(({name}) => name));
      let number = 1;
      while (names.has(`구성 ${number}`)) number++;
      const name = `구성 ${number}`;
      const chosen =
        base === undefined
          ? undefined
          : song.arrangements?.find(item => item.name === base);
      const groups =
        chosen !== undefined && chosen.groups.length > 0
          ? [...chosen.groups]
          : song.groups.map(group => group.id);
      this.history.setArrangementGroups(name, groups);
      this.dirty = true;
      this.endTyping();
      this.options.changed();
      return name;
    }
    const value = newArrangement(song, base);
    this.history.addArrangement(value);
    this.dirty = true;
    this.endTyping();
    this.options.changed();
    return value.name;
  }

  /**
   * Saves a named 구성's new order as one undo step, as the 예배 순서 item's
   * chip strip edits it. The 슬라이드 themselves stay as they are.
   */
  setArrangementSlides(name: string, slides: readonly number[]): boolean {
    if (!this.acceptsEdits) return false;
    const song = this.history.snapshot.song;
    if (isGroupedSong(song)) return false;
    const count = song.slides.length;
    if (
      !slides.every(
        slide => Number.isInteger(slide) && slide >= 1 && slide <= count,
      )
    ) {
      return false;
    }
    if (!this.history.setArrangementSlides(name, slides)) return false;
    this.dirty = true;
    this.endTyping();
    this.options.changed();
    return true;
  }

  /**
   * Saves a named 구성's new group order as one undo step.
   */
  setArrangementGroups(name: string, groups: readonly SongGroupId[]): boolean {
    if (!this.acceptsEdits) return false;
    const song = this.history.snapshot.song;
    if (!isGroupedSong(song)) return false;
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
    if (this.hasChanges || this.writing) this.delaySave();
    else this.cancelSaveTimer();
    this.options.changed();
  }

  finishTitle(): void {
    if (this.options.persistence === 'manual') {
      this.endTyping();
      return;
    }
    this.title.revertInvalid();
    if (!this.writing && !this.blocked && !this.hasChanges) {
      if (this.incoming !== undefined) this.install(this.incoming);
      else this.title.accept(this.document.song.title, this.title.value);
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

  receive(document: EditorSongDocument<S>): void {
    if (document.revision <= this.document.revision) return;
    if (
      this.dirty ||
      this.title.hasDraft ||
      this.backgroundEdited ||
      this.writing ||
      this.blocked
    ) {
      if (document.revision > (this.incoming?.revision ?? 0)) {
        this.incoming = document;
      }
    } else this.install(document);
  }

  install(document: EditorSongDocument<S>): void {
    this.cancelSaveTimer();
    this.document = document;
    this.history = new SongHistory(document.song);
    this.reconcileArrangement();
    this.title = new SongTitleDraft(
      document.song.title,
      this.options.isDuplicateTitle,
    );
    this.background = document.song.background;
    this.backgroundEdited = false;
    this.blocked = false;
    this.dirty = false;
    this.incoming = undefined;
    this.options.changed();
  }

  renamed(from: string, to: string, document?: EditorSongDocument<S>): void {
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
    document?: EditorSongDocument<S>,
  ): void {
    this.history.changeArrangement(from, to);
    if (this.pickedArrangement === from) this.pickedArrangement = to;
    if (document !== undefined) this.acceptGlobalEdit(document);
    this.options.changed();
  }

  private acceptGlobalEdit(document: EditorSongDocument<S>): void {
    const current = this.history.snapshot.song;
    const sameStructure =
      isGroupedSong(current) && isGroupedSong(document.song)
        ? JSON.stringify(document.song.groups) ===
            JSON.stringify(current.groups) &&
          JSON.stringify(document.song.arrangements) ===
            JSON.stringify(current.arrangements)
        : !isGroupedSong(current) && !isGroupedSong(document.song)
          ? JSON.stringify(document.song.slides) ===
              JSON.stringify(current.slides) &&
            JSON.stringify(document.song.arrangements) ===
              JSON.stringify(current.arrangements)
          : false;

    if (!sameStructure) {
      this.install(document);
    } else {
      this.document = document;
      this.title.accept(document.song.title);
      if (!this.backgroundEdited) this.background = document.song.background;
      this.reconcileArrangement();
    }
  }

  async flush(): Promise<boolean> {
    if (this.options.persistence === 'manual') return true;
    do {
      this.cancelSaveTimer();
      if (!(await this.save())) return false;
    } while (this.hasChanges);
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
    this.title = new SongTitleDraft(this.document.song.title);
    this.background = this.document.song.background;
    this.backgroundEdited = false;
  }

  private delaySave(): void {
    if (this.options.persistence === 'manual') return;
    this.cancelSaveTimer();
    this.saveTimer = setTimeout(() => this.endTyping(), TYPING_PAUSE_MS);
  }

  private cancelSaveTimer(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
  }

  private save(): Promise<boolean> {
    if (this.options.persistence === 'manual') return Promise.resolve(true);
    if (this.pending !== undefined) return this.pending;
    if (!this.hasChanges || this.blocked) return Promise.resolve(!this.blocked);
    this.writing = true;
    this.pending = this.drain().finally(() => {
      this.writing = false;
      this.pending = undefined;
      this.options.changed();
    });
    return this.pending;
  }

  private async drain(): Promise<boolean> {
    while (this.hasChanges && !this.blocked && this.saveTimer === undefined) {
      const lyricsDirty = this.dirty;
      this.dirty = false;
      const draft = this.history.snapshot.song;
      const titleDraft =
        this.title.reason === undefined ? this.title.value : undefined;
      const background = this.background;

      if (isGroupedSong(draft) || isGroupedSong(this.document.song)) {
        // NOTE(0913vision): Grouped song persistence waits for group-7 store activation.
        this.options.changed();
        return true;
      }

      const song: Song = {
        ...this.document.song,
        ...draft,
        title: this.title.nextValue,
        slides: draft.slides,
        ...(draft.arrangements === undefined
          ? {}
          : {arrangements: draft.arrangements}),
        ...(background === undefined ? {} : {background}),
      };

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
          this.title.reject(song.title);
          this.dirty ||= lyricsDirty;
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
                  title: this.title.nextValue,
                  ...(background === undefined ? {} : {background}),
                },
                revision: applied.revision,
              };
        this.incoming = undefined;
        this.title.accept(this.document.song.title, titleDraft);
        if (!this.backgroundEdited || this.background === background) {
          this.background = this.document.song.background;
          this.backgroundEdited = false;
        }
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
