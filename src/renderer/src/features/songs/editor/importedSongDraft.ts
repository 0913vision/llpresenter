import type {LibrarySong, SongDocument} from '@core/schema/contentDocuments';
import {parseSongDocument} from '@core/schema/contentDocuments';
import type {ContentEdit} from '@core/schema/contentEdit';
import {parseGroupedSongDraft} from '@core/schema/groupedSong';
import type {SongId} from '@core/schema/ids';
import {createSongId} from '@core/schema/ids';
import type {TextImportDraft} from '@core/schema/textImport';
import {
  ImportDraftLimitError,
  importDraftSlides,
} from '@core/songs/importDraftSlides';
import {ARRANGEMENT_LIMIT_REASON} from '@core/songs/songArrangements';
import {normalizeSongTitle} from '@core/songs/songTitle';
import type {EditorApi, EditorOperationHost} from './editorContracts';
import {SongSession} from './songSession';
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

  openImported(draft: TextImportDraft): void {
    if (!this.context.host.alive() || this.context.host.locked()) return;
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
      this.context.host.problem('가져온 곡 열기 실패');
      return;
    }
    const checked = parseSongDocument({
      song: migrated.value.data,
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
    this.imported.editTitle(draft.title);
    this.context.focusTitle();
    this.context.host.publish();
  }

  requestLeave(action: () => void): void {
    if (!this.context.host.alive() || this.context.host.locked()) return;
    if (this.imported === null) action();
    else {
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
    this.context.host.problem('중복 곡이 변경되었습니다');
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
        this.pendingLeave = null;
        this.context.open(document);
        return true;
      } catch (error) {
        console.error('Imported song save failed', error);
        this.context.host.problem(
          error instanceof ImportDraftLimitError
            ? ARRANGEMENT_LIMIT_REASON
            : '가져온 곡 저장 실패',
        );
        return false;
      }
    });
  }
}
