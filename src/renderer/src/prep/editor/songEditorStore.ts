import type {LlpApi} from '@shared/ipc';
import type {LibrarySong, SongDocument} from '@shared/schema/contentDocuments';
import type {SongId} from '@shared/schema/ids';
import type {Label} from '@shared/schema/labels';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {SongSession} from './songSession';
import {editorTask} from './editorTask';
import {normalizeSongTitle} from './songTitle';

export type EditorApi = Pick<
  LlpApi,
  'songs' | 'content' | 'settings' | 'media'
>;
export type EditorLabels = Extract<SettingsDocument, {name: 'labels'}>;
interface EditorState {
  readonly session: SongSession | null;
  readonly labels: EditorLabels | null;
  readonly busy: boolean;
  readonly library: readonly LibrarySong[];
  readonly titleFocus: number;
}

const MAX_SESSIONS = 20;

/** One control window's editor sessions. The host disposes it at window close. */
export class SongEditorStore {
  private readonly sessions = new Map<SongId, SongSession>();
  private readonly listeners = new Set<() => void>();
  private readonly stops: ReadonlyArray<() => void>;
  private readonly renamedSongs = new Map<SongId, SongDocument>();
  private labels: EditorLabels | null = null;
  private active: SongId | null = null;
  private itemSong: SongId | null = null;
  private busy = false;
  private renaming = false;
  private alive = true;
  private operation: Promise<boolean> | undefined;
  private library: readonly LibrarySong[] = [];
  private libraryVersion = 0;
  private focusSerial = 0;
  private titleFocus = 0;
  private state: EditorState = {
    session: null,
    labels: null,
    busy: false,
    library: [],
    titleFocus: 0,
  };

  constructor(
    readonly api: EditorApi,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    this.stops = [
      api.settings.subscribe(document => this.acceptLabels(document)),
      api.songs.subscribe(change => {
        const session = this.sessions.get(change.songId);
        if (session === undefined) return;
        if (change.document === null) this.remove(change.songId);
        else if (this.renaming) {
          if (
            change.document.revision >
            (this.renamedSongs.get(change.songId)?.revision ?? 0)
          ) {
            this.renamedSongs.set(change.songId, change.document);
          }
        } else session.receive(change.document);
      }),
      api.songs.subscribeList(entries => {
        this.libraryVersion++;
        this.acceptLibrary(entries);
      }),
    ];
    editorTask(this.readLabels());
    editorTask(this.readLibrary());
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
    options: {readonly focusTitle?: boolean} = {},
  ): void {
    if (!this.alive) return;
    if (this.active !== null && this.active !== document?.song.id) {
      this.sessions.get(this.active)?.endTyping();
    }
    this.active = document?.song.id ?? null;
    this.titleFocus =
      document !== null && options.focusTitle === true ? ++this.focusSerial : 0;
    if (document !== null) this.sessionFor(document);
    this.publish();
  }

  /**
   * Gives the song's session without opening it in the editor, so a 예배 순서
   * item edits its 구성 through the same writer as the editor.
   */
  attach(document: SongDocument): SongSession | undefined {
    if (!this.alive) return undefined;
    const session = this.sessionFor(document);
    this.publish();
    return session;
  }

  sessionOf(id: SongId): SongSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Names the song the 예배 순서 item panel shows, or none. Like the song open
   * in the editor, its session is never evicted.
   */
  showItemSong(id: SongId | null): void {
    this.itemSong = id;
    if (id !== null) this.touch(id);
  }

  private sessionFor(document: SongDocument): SongSession {
    const id = document.song.id;
    const existing = this.sessions.get(id);
    if (existing !== undefined) {
      this.touch(id);
      existing.receive(document);
      return existing;
    }
    const session = new SongSession({
      document,
      api: this.api.content,
      isDuplicateTitle: value =>
        this.library.some(
          entry =>
            entry.id !== document.song.id &&
            normalizeSongTitle(entry.title) === value,
        ),
      changed: () => this.publish(),
      problem: () =>
        this.problem('곡 저장 실패', () => this.reload(document.song.id)),
    });
    this.sessions.set(id, session);
    this.evict(id);
    return session;
  }

  private touch(id: SongId): void {
    const session = this.sessions.get(id);
    if (session === undefined) return;
    this.sessions.delete(id);
    this.sessions.set(id, session);
  }

  /**
   * Keeps at most {@link MAX_SESSIONS} sessions by dropping the least recently
   * used clean ones, with their undo history. A session with unsaved edits,
   * the editor's, and the item panel's always stay.
   */
  private evict(created: SongId): void {
    if (this.busy) return;
    for (const [id, session] of this.sessions) {
      if (this.sessions.size <= MAX_SESSIONS) return;
      if (
        id !== created &&
        id !== this.active &&
        id !== this.itemSong &&
        session.clean
      ) {
        session.discard();
        this.sessions.delete(id);
      }
    }
  }

  /** Claims a new-song focus request once, including across panel remounts. */
  consumeTitleFocus(request: number): boolean {
    if (request === 0 || request !== this.titleFocus) return false;
    this.titleFocus = 0;
    this.publish();
    return true;
  }

  updateLabels(labels: readonly Label[]): Promise<boolean> {
    const document = this.labels;
    if (document === null) return Promise.resolve(false);
    return this.editLabels({
      type: 'settings.update',
      name: 'labels',
      value: {...document.value, labels},
      baseRevision: document.revision,
    });
  }

  renameLabel(from: string, to: string): Promise<boolean> {
    const document = this.labels;
    if (document === null) return Promise.resolve(false);
    return this.editLabels({
      type: 'labels.rename',
      name: 'labels',
      from,
      to,
      baseRevision: document.revision,
    });
  }

  renameArrangement(from: string, to: string): Promise<boolean> {
    return this.editArrangement(from, to);
  }

  deleteArrangement(name: string): Promise<boolean> {
    return this.editArrangement(name, undefined);
  }

  private editArrangement(
    from: string,
    to: string | undefined,
  ): Promise<boolean> {
    const session =
      this.active === null ? undefined : this.sessions.get(this.active);
    if (!this.alive || this.busy || session === undefined || session.readOnly) {
      return Promise.resolve(false);
    }
    if (
      !session.history.snapshot.song.arrangements?.some(
        item => item.name === from,
      )
    ) {
      return Promise.resolve(false);
    }
    return this.runOperation(() => this.writeArrangement(session, from, to));
  }

  /** Preflight shutdown before unmounting; false keeps a refused draft alive. */
  async flush(): Promise<boolean> {
    await this.operation;
    const results = await Promise.all(
      [...this.sessions.values()].map(session => session.flush()),
    );
    return results.every(Boolean);
  }

  async dispose(): Promise<void> {
    this.alive = false;
    for (const stop of this.stops) stop();
    await this.operation;
    await Promise.all(
      [...this.sessions.values()].map(session => session.close()),
    );
    this.sessions.clear();
    this.renamedSongs.clear();
    this.listeners.clear();
  }

  private editLabels(edit: SettingsEdit): Promise<boolean> {
    if (!this.alive || this.busy || this.labels?.access !== 'editable') {
      return Promise.resolve(false);
    }
    return this.runOperation(() => this.writeLabels(edit));
  }

  private async writeArrangement(
    session: SongSession,
    from: string,
    to: string | undefined,
  ): Promise<boolean> {
    try {
      const saved = await Promise.all(
        [...this.sessions.values()].map(item => item.flush()),
      );
      if (saved.includes(false)) return false;
      this.renaming = true;
      const songId = session.document.song.id;
      const result = await this.api.content.edit(
        to === undefined
          ? {type: 'song.arrangement.delete', songId, name: from}
          : {type: 'song.arrangement.rename', songId, from, to},
      );
      if (!result.ok && result.error.reason !== 'write-failed') {
        this.problem('구성 변경 실패');
        return false;
      }
      const accepted = await this.acceptArrangement(session, from, to);
      if (!result.ok) this.problem('구성 파일 저장 실패');
      return accepted;
    } catch (error) {
      console.error('Arrangement edit failed', error);
      session.blocked = true;
      this.problem('구성 변경 실패', () =>
        this.reload(session.document.song.id),
      );
      return false;
    }
  }

  private async acceptArrangement(
    session: SongSession,
    from: string,
    to: string | undefined,
  ): Promise<boolean> {
    const songId = session.document.song.id;
    const read =
      this.renamedSongs.get(songId) ?? (await this.api.songs.get(songId));
    if (this.sessions.get(songId) !== session) return false;
    const pushed = this.renamedSongs.get(songId);
    const document =
      pushed !== undefined && (read === null || pushed.revision > read.revision)
        ? pushed
        : read;
    if (document === null) this.remove(songId);
    else session.arrangementChanged(from, to, document);
    this.renamedSongs.delete(songId);
    return document !== null;
  }

  private runOperation(task: () => Promise<boolean>): Promise<boolean> {
    this.busy = true;
    this.publish();
    this.operation = task().finally(() => {
      this.renaming = false;
      for (const [id, document] of this.renamedSongs) {
        this.sessions.get(id)?.receive(document);
      }
      this.renamedSongs.clear();
      this.busy = false;
      this.operation = undefined;
      this.publish();
    });
    return this.operation;
  }

  private async writeLabels(edit: SettingsEdit): Promise<boolean> {
    try {
      if (edit.type === 'labels.rename') {
        const saved = await Promise.all(
          [...this.sessions.values()].map(session => session.flush()),
        );
        if (saved.includes(false)) return false;
        this.renaming = true;
      }
      const result = await this.api.settings.edit(edit);
      const applied = result.ok || result.error.reason === 'write-failed';
      if (!applied) {
        this.problem('이름표 변경 실패');
        return false;
      }
      if (edit.type === 'labels.rename') {
        await this.acceptRename(edit.from, edit.to);
        this.renamedSongs.clear();
      }
      await this.readLabels();
      if (!result.ok) this.problem('이름표 파일 저장 실패');
      return true;
    } catch {
      this.problem('이름표 변경 실패');
      return false;
    }
  }

  private async acceptRename(from: string, to: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      const document =
        this.renamedSongs.get(id) ??
        (session.document.song.slides.some(slide => slide.label === from)
          ? await this.api.songs.get(id)
          : undefined);
      if (document === null) this.remove(id);
      else session.renamed(from, to, document);
    }
  }

  private async readLabels(): Promise<void> {
    try {
      this.acceptLabels(await this.api.settings.get({name: 'labels'}));
    } catch {
      this.problem('이름표 불러오기 실패', () => this.readLabels());
    }
  }

  private async readLibrary(): Promise<void> {
    const version = ++this.libraryVersion;
    try {
      const entries = await this.api.songs.list();
      if (this.alive && version === this.libraryVersion) {
        this.acceptLibrary(entries);
      }
    } catch {
      this.problem('곡 목록 불러오기 실패', () => this.readLibrary());
    }
  }

  private acceptLibrary(entries: readonly LibrarySong[]): void {
    if (!this.alive) return;
    this.library = entries;
    const ids = new Set(entries.map(entry => entry.id));
    for (const id of this.sessions.keys()) {
      if (!ids.has(id)) this.remove(id);
    }
    this.publish();
  }

  private acceptLabels(document: SettingsDocument): void {
    if (
      this.alive &&
      document.name === 'labels' &&
      (this.labels === null || document.revision > this.labels.revision)
    ) {
      this.labels = document;
      this.publish();
    }
  }

  private async reload(id: SongId): Promise<void> {
    try {
      const document = await this.api.songs.get(id);
      if (!this.alive) return;
      if (document === null) this.remove(id);
      else this.sessions.get(id)?.install(document);
    } catch {
      this.problem('곡 불러오기 실패', () => this.reload(id));
    }
  }

  private remove(id: SongId): void {
    this.sessions.get(id)?.discard();
    this.sessions.delete(id);
    if (this.active === id) this.active = null;
    this.publish();
  }

  private problem(title: string, retry?: () => unknown): void {
    if (this.alive) {
      this.onProblem({
        key: `editor:${this.active}:${title}`,
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
    this.state = {
      session:
        this.active === null ? null : (this.sessions.get(this.active) ?? null),
      labels: this.labels,
      busy: this.busy,
      library: this.library,
      titleFocus: this.titleFocus,
    };
    for (const listener of this.listeners) listener();
  }
}
