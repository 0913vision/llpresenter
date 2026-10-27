import type {LlpApi} from '@shared/ipc';
import type {ContentEdit} from '@shared/schema/contentEdit';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import type {LibrarySong, SongDocument} from '@shared/schema/contentDocuments';
import type {SongId} from '@shared/schema/ids';
import {createSongId} from '@shared/schema/ids';
import type {TextImportDraft} from '@shared/schema/textImport';
import {DEFAULT_ARRANGEMENT_NAME} from '@shared/schema/song';
import {parseGroupedSongDraft} from '@shared/schema/groupedSong';
import type {Label} from '@shared/schema/labels';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {SongSession} from './songSession';
import {ImportDraftLimitError, importDraftSlides} from './importDraftSlides';
import {ARRANGEMENT_LIMIT_REASON} from './songArrangements';
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
  readonly libraryStatus: 'loading' | 'ready' | 'failed';
  readonly titleFocus: number;
  readonly imported: boolean;
  readonly discardRequested: boolean;
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
  private imported: SongSession | null = null;
  private importedSaved: SongId | null = null;
  private pendingLeave: (() => void) | null = null;
  private itemSong: SongId | null = null;
  private busy = false;
  private editingStopped = false;
  private renaming = false;
  private alive = true;
  private operation: Promise<boolean> | undefined;
  private library: readonly LibrarySong[] = [];
  private libraryStatus: EditorState['libraryStatus'] = 'loading';
  private libraryVersion = 0;
  private focusSerial = 0;
  private titleFocus = 0;
  private state: EditorState = {
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
    if (this.imported !== null) {
      this.requestLeave(() => this.open(document, options));
      return;
    }
    if (this.active !== null && this.active !== document?.song.id) {
      this.sessions.get(this.active)?.endTyping();
    }
    this.active = document?.song.id ?? null;
    this.titleFocus =
      document !== null && options.focusTitle === true ? ++this.focusSerial : 0;
    if (document !== null) this.sessionFor(document);
    this.publish();
  }

  openImported(draft: TextImportDraft): void {
    if (!this.alive || this.locked) return;
    if (this.imported !== null) {
      this.requestLeave(() => this.openImported(draft));
      return;
    }
    const migrated = parseGroupedSongDraft(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: createSongId(crypto.randomUUID()),
        title: normalizeSongTitle(draft.title) || '가져온 곡',
        slides: draft.slides,
      }),
      'imported song',
    );
    if (!migrated.ok) {
      this.problem('가져온 곡 열기 실패');
      return;
    }
    const checked = parseSongDocument({
      song: migrated.value.data,
      revision: 1,
      access: 'editable',
    });
    if (!checked.ok || checked.value === null) {
      this.problem('가져온 곡 열기 실패');
      return;
    }
    this.sessions.get(this.active ?? checked.value.song.id)?.endTyping();
    this.active = null;
    this.imported = new SongSession({
      document: checked.value,
      api: this.api.content,
      persistence: 'manual',
      changed: () => this.publish(),
      editingStopped: () => this.locked,
      isDuplicateTitle: title =>
        this.library.some(entry => normalizeSongTitle(entry.title) === title),
      problem: () => this.problem('가져온 곡 저장 실패'),
    });
    this.imported.editTitle(draft.title);
    this.titleFocus = ++this.focusSerial;
    this.publish();
  }

  requestLeave(action: () => void): void {
    if (!this.alive || this.locked) return;
    if (this.imported === null) action();
    else {
      this.pendingLeave = action;
      this.publish();
    }
  }

  cancelDiscard(): void {
    this.pendingLeave = null;
    this.publish();
  }

  reportImportReadFailure(): void {
    this.problem('덮어쓸 곡 불러오기 실패');
  }

  reportImportTargetChanged(): void {
    this.problem('중복 곡이 변경되었습니다');
  }

  discardImported(): void {
    if (this.locked) return;
    const action = this.pendingLeave;
    this.pendingLeave = null;
    this.imported?.discard();
    this.imported = null;
    this.importedSaved = null;
    this.publish();
    action?.();
  }

  saveImported(
    target: Extract<ContentEdit, {type: 'song.import'}>['target'],
  ): Promise<boolean> {
    const session = this.imported;
    if (!this.alive || this.locked || session === null) {
      return Promise.resolve(false);
    }
    return this.runOperation(async () => {
      try {
        const song = session.history.snapshot.song;
        if (this.importedSaved === null) {
          if (target.kind === 'overwrite') {
            await this.sessions.get(target.songId)?.flush();
          }
          const result = await this.api.content.edit({
            type: 'song.import',
            target,
            draft: {
              title: normalizeSongTitle(session.title.value),
              ...importDraftSlides(song),
              ...(session.background === undefined
                ? {}
                : {background: session.background}),
            },
          });
          const applied = result.ok
            ? result.value
            : result.error.reason === 'write-failed'
              ? result.error.applied
              : undefined;
          if (applied === undefined) {
            this.problem('가져온 곡 저장 실패');
            return false;
          }
          this.importedSaved = createSongId(applied.id);
          session.blocked = true;
          if (!result.ok) this.problem('곡 파일 저장 실패');
        }
        const document = await this.api.songs.get(this.importedSaved);
        if (document === null) {
          this.problem('저장한 곡 불러오기 실패');
          return false;
        }
        if (!this.alive) return false;
        this.sessions.get(document.song.id)?.install(document);
        session.discard();
        this.imported = null;
        this.importedSaved = null;
        this.pendingLeave = null;
        this.open(document);
        return true;
      } catch (error) {
        console.error('Imported song save failed', error);
        this.problem(
          error instanceof ImportDraftLimitError
            ? ARRANGEMENT_LIMIT_REASON
            : '가져온 곡 저장 실패',
        );
        return false;
      }
    });
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
      editingStopped: () => this.editingStopped,
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

  // NOTE(0913vision): Dropping a clean session loses only its undo history. A
  // session with unsaved edits, the editor's, and the item panel's stay, so
  // the count can pass the cap until they are saved or closed.
  private evict(created?: SongId): void {
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
      this.imported ??
      (this.active === null ? undefined : this.sessions.get(this.active));
    if (
      !this.alive ||
      this.locked ||
      session === undefined ||
      session.readOnly
    ) {
      return Promise.resolve(false);
    }
    if (
      !session.history.snapshot.song.arrangements?.some(
        item => item.name === from,
      )
    ) {
      return Promise.resolve(false);
    }
    if (this.imported === session) {
      if (
        to !== undefined &&
        (!to.trim() ||
          to === DEFAULT_ARRANGEMENT_NAME ||
          session.history.snapshot.song.arrangements.some(
            item => item.name === to && item.name !== from,
          ))
      ) {
        return Promise.resolve(false);
      }
      session.arrangementChanged(from, to);
      return Promise.resolve(true);
    }
    return this.runOperation(() => this.writeArrangement(session, from, to));
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
      const results = await Promise.all(
        [...this.sessions.values()].map(session => session.flush()),
      );
      flushed =
        operationDone && results.every(Boolean) && this.imported === null;
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
    for (const stop of this.stops) stop();
    await this.operation;
    await Promise.all(
      [...this.sessions.values()].map(session => session.close()),
    );
    this.sessions.clear();
    this.imported?.discard();
    this.imported = null;
    this.pendingLeave = null;
    this.renamedSongs.clear();
    this.listeners.clear();
  }

  private editLabels(edit: SettingsEdit): Promise<boolean> {
    if (!this.alive || this.locked || this.labels?.access !== 'editable') {
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
      this.renaming = false;
      for (const [id, document] of this.renamedSongs) {
        this.sessions.get(id)?.receive(document);
      }
      this.renamedSongs.clear();
      this.busy = false;
      this.operation = undefined;
      this.evict();
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
    this.imported?.renamed(from, to);
    for (const [id, session] of this.sessions) {
      const document =
        this.renamedSongs.get(id) ??
        (session.document.song.groups.some(group => group.name === from)
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
    this.libraryStatus = 'loading';
    this.publish();
    try {
      const entries = await this.api.songs.list();
      if (this.alive && version === this.libraryVersion) {
        this.acceptLibrary(entries);
      }
    } catch {
      if (!this.alive || version !== this.libraryVersion) {
        return;
      }
      this.libraryStatus = 'failed';
      this.publish();
      this.problem('곡 목록 불러오기 실패', () => this.readLibrary());
    }
  }

  private acceptLibrary(entries: readonly LibrarySong[]): void {
    if (!this.alive) return;
    this.library = entries;
    this.libraryStatus = 'ready';
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
        this.imported ??
        (this.active === null
          ? null
          : (this.sessions.get(this.active) ?? null)),
      labels: this.labels,
      busy: this.locked,
      library: this.library,
      libraryStatus: this.libraryStatus,
      titleFocus: this.titleFocus,
      imported: this.imported !== null,
      discardRequested: this.pendingLeave !== null,
    };
    for (const listener of this.listeners) listener();
  }
}
