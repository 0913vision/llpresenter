import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import {parseSongDocument} from '@core/schema/contentDocuments';
import type {ContentEdit} from '@core/schema/contentEdit';
import {SONG_SCHEMA_VERSION, type Song} from '@core/schema/song';
import type {SongId} from '@core/schema/ids';
import {createSongId, createSongSlideId} from '@core/schema/ids';
import type {TextImportDraft} from '@core/schema/textImport';
import {importSlides} from '@core/songs/importSlides';
import {normalizeSongTitle} from '@core/songs/songTitle';
import type {EditorApi, EditorOperationHost} from './editorContracts';
import {SongSession} from './songSession';
import {songSlideClipboardFor} from './songSlideHistory';
import type {SongSessionPool} from './songSessionPool';

/**
 * Borrows navigation and the facade gate; it never opens another save queue.
 */
export interface ImportedSongDraftOptions {
  readonly api: EditorApi;
  readonly pool: SongSessionPool;
  readonly host: EditorOperationHost;
  readonly library: () => readonly LibrarySong[];
  readonly clearActionRequest: () => void;
  readonly focusTitle: () => void;
  readonly open: (document: SongDocument) => void;
}

/**
 * Owns the existing manual import session and deferred navigation. An applied
 * id survives read-back failure, so retry never creates a second saved song.
 * The facade owns operation serialization and the normal per-song sessions.
 */
export class ImportedSongDraft {
  private imported: SongSession | null = null;
  private importedSaved: SongId | null = null;
  private pendingLeave: (() => void) | null = null;
  private fresh = false;

  constructor(private readonly context: ImportedSongDraftOptions) {}
  get session(): SongSession | null {
    return this.imported;
  }
  get discardRequested(): boolean {
    return this.pendingLeave !== null;
  }
  dispose(): void {
    this.imported?.discard();
    this.imported = null;
    this.pendingLeave = null;
  }

  openImported(draft: TextImportDraft, fresh = false): void {
    if (!this.context.host.alive() || this.context.host.locked()) return;
    if (this.imported !== null) {
      this.requestLeave(() => this.openImported(draft, fresh));
      return;
    }
    this.fresh = fresh;
    const song: Song = {
      format: 'llsong',
      schemaVersion: SONG_SCHEMA_VERSION,
      id: createSongId(crypto.randomUUID()),
      title: normalizeSongTitle(draft.title) || '가져온 곡',
      ...(draft.background === undefined ? {} : {background: draft.background}),
      slides: [
        ...(draft.preserveSlides
          ? []
          : [
              {
                id: createSongSlideId(crypto.randomUUID()),
                titleSlide: true,
                lines: [normalizeSongTitle(draft.title) || '가져온 곡'],
              } as const,
            ]),
        ...importSlides(draft.slides, () => crypto.randomUUID()),
      ],
    };
    const checked = parseSongDocument({
      song,
      revision: 1,
      access: 'editable',
    });
    if (!checked.ok || checked.value === null) {
      this.context.host.problem('가져온 곡 열기 실패');
      return;
    }
    this.context.pool
      .get(this.context.pool.editorSongId ?? checked.value.song.id)
      ?.endTyping();
    this.context.pool.pinEditor(null);
    this.context.clearActionRequest();
    this.imported = new SongSession({
      document: checked.value,
      clipboard: songSlideClipboardFor(this.context.api),
      api: this.context.api.content,
      persistence: 'manual',
      changed: () => this.context.host.publish(),
      editingStopped: () => this.context.host.locked(),
      isDuplicateTitle: title =>
        this.context
          .library()
          .some(entry => normalizeSongTitle(entry.title) === title),
      problem: () => this.context.host.problem('가져온 곡 저장 실패'),
    });
    if (!fresh) this.imported.editTitle(draft.title);
    this.context.focusTitle();
    this.context.host.publish();
  }

  openNew(): void {
    this.openImported({title: '새 곡', slides: [{lines: []}]}, true);
  }

  requestLeave(action: () => void): void {
    if (!this.context.host.alive() || this.context.host.locked()) return;
    if (this.imported === null) action();
    else if (this.fresh && this.imported.clean) {
      this.pendingLeave = action;
      this.discardImported();
    } else {
      this.pendingLeave = action;
      this.context.host.publish();
    }
  }

  cancelDiscard(): void {
    this.pendingLeave = null;
    this.context.host.publish();
  }

  reportImportReadFailure(): void {
    this.context.host.problem('덮어쓸 곡 불러오기 실패');
  }

  reportImportTargetChanged(): void {
    this.context.host.problem('같은 곡이 바뀌었습니다');
  }

  discardImported(): void {
    if (this.context.host.locked()) return;
    const action = this.pendingLeave;
    this.pendingLeave = null;
    this.imported?.discard();
    this.imported = null;
    this.importedSaved = null;
    this.context.host.publish();
    action?.();
  }

  saveImported(
    target: Extract<ContentEdit, {type: 'song.import'}>['target'],
  ): Promise<boolean> {
    const session = this.imported;
    if (
      !this.context.host.alive() ||
      this.context.host.locked() ||
      session === null
    ) {
      return Promise.resolve(false);
    }
    return this.context.host.runOperation(async () => {
      try {
        const song = session.history.snapshot.song;
        if (this.importedSaved === null) {
          if (target.kind === 'overwrite') {
            await this.context.pool.get(target.songId)?.flush();
          }
          const result = await this.context.api.content.edit({
            type: 'song.import',
            target,
            draft: {
              title: normalizeSongTitle(session.title.value),
              slides: song.slides,
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
            this.context.host.problem('가져온 곡 저장 실패');
            return false;
          }
          this.importedSaved = createSongId(applied.id);
          session.blocked = true;
          if (!result.ok) this.context.host.problem('곡 파일 저장 실패');
        }
        const document = await this.context.api.songs.get(this.importedSaved);
        if (document === null) {
          this.context.host.problem('저장한 곡 불러오기 실패');
          return false;
        }
        if (!this.context.host.alive()) return false;
        this.context.pool.get(document.song.id)?.install(document);
        session.discard();
        this.imported = null;
        this.importedSaved = null;
        const continuation = this.pendingLeave;
        this.pendingLeave = null;
        this.context.open(document);
        continuation?.();
        return true;
      } catch (error) {
        console.error('Imported song save failed', error);
        this.context.host.problem('가져온 곡 저장 실패');
        return false;
      }
    });
  }
}
