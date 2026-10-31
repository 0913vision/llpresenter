import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {normalizeSongTitle} from '@core/songs/songTitle';
import type {EditorApi, EditorOperationHost} from './editorContracts';
import {SongSession} from './songSession';

/**
 * Live facade checks and readers, without a second editor state or writer.
 */
export interface SongSessionPoolOptions {
  readonly api: EditorApi;
  readonly host: Pick<EditorOperationHost, 'alive' | 'publish' | 'problem'>;
  readonly library: () => readonly LibrarySong[];
  readonly busy: () => boolean;
  readonly editingStopped: () => boolean;
}

const MAX_SESSIONS = 20;

/**
 * Owns one session, writer and undo history per song. Active, item and dirty
 * sessions survive the existing 20-session soft cap; manual imports stay out.
 */
export class SongSessionPool {
  private readonly sessions = new Map<SongId, SongSession>();
  private active: SongId | null = null;
  private itemSong: SongId | null = null;

  constructor(private readonly context: SongSessionPoolOptions) {}

  get editorSongId(): SongId | null {
    return this.active;
  }
  pinEditor(id: SongId | null): void {
    this.active = id;
  }
  get(id: SongId): SongSession | undefined {
    return this.sessions.get(id);
  }
  values() {
    return this.sessions.values();
  }
  keys() {
    return this.sessions.keys();
  }
  [Symbol.iterator]() {
    return this.sessions[Symbol.iterator]();
  }
  clear(): void {
    this.sessions.clear();
  }
  flushAll(): Promise<boolean[]> {
    return Promise.all(
      [...this.sessions.values()].map(session => session.flush()),
    );
  }
  closeAll(): Promise<boolean[]> {
    return Promise.all(
      [...this.sessions.values()].map(session => session.close()),
    );
  }

  attach(document: SongDocument): SongSession {
    const id = document.song.id;
    const existing = this.sessions.get(id);
    if (existing !== undefined) {
      this.touch(id);
      existing.receive(document);
      return existing;
    }
    const session = new SongSession({
      document,
      api: this.context.api.content,
      isDuplicateTitle: value =>
        this.context
          .library()
          .some(
            entry =>
              entry.id !== document.song.id &&
              normalizeSongTitle(entry.title) === value,
          ),
      changed: () => this.context.host.publish(),
      editingStopped: () => this.context.editingStopped(),
      problem: () =>
        this.context.host.problem('곡 저장 실패', () =>
          this.reload(document.song.id),
        ),
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
  evict(created?: SongId): void {
    if (this.context.busy()) return;
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

  async reload(id: SongId): Promise<void> {
    try {
      const document = await this.context.api.songs.get(id);
      if (!this.context.host.alive()) return;
      if (document === null) this.remove(id);
      else this.sessions.get(id)?.install(document);
    } catch {
      this.context.host.problem('곡 불러오기 실패', () => this.reload(id));
    }
  }

  remove(id: SongId): void {
    this.sessions.get(id)?.discard();
    this.sessions.delete(id);
    if (this.active === id) this.active = null;
    this.context.host.publish();
  }

  /**
   * Names the song the 예배 순서 item panel shows, or none. Like the song open
   * in the editor, its session is never evicted.
   */
  showItemSong(id: SongId | null): void {
    this.itemSong = id;
    if (id !== null) this.touch(id);
  }
}
