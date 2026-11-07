import type {LlpApi} from '@contracts/ipc/api';
import {
  noteThumbnailItems,
  noteThumbnailStamps,
} from '@contracts/ipc/thumbnailRevisions';
import type {MediaId} from '@core/schema/ids';
import type {
  MediaDocument,
  MediaImportProgress,
  MediaImportRequest,
} from '@core/schema/mediaEdit';
import type {MediaStamps, MissingMedia} from '@core/schema/mediaFiles';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {updateActiveCopies, type CopyJob} from './mediaCopyJobs';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {chosenPlaylist, type ChosenPlaylist} from './mediaEntries';
import type {MediaProps} from './mediaProps';
import {mediaImportFailureNotice, requestMediaImport} from './mediaImport';

/** What the media view uses of the window API. */
export type MediaApi = Pick<LlpApi, 'media' | 'log'>;

/** The media list as the media view shows it. */
export interface MediaLibraryView {
  readonly document: MediaDocument | null;
  /** Imports that wait, copy, or are analysed, oldest first. */
  readonly jobs: readonly CopyJob[];
  /** The media whose file main can't find. */
  readonly missing: ReadonlySet<MediaId>;
  /** The playlist each import started here joins, by its media id. */
  readonly destinations: ReadonlyMap<MediaId, string>;
}

const EMPTY: MediaLibraryView = {
  document: null,
  jobs: [],
  missing: new Set(),
  destinations: new Map(),
};

const ENDED = new Set<MediaImportProgress['phase']>([
  'complete',
  'failed',
  'cancelled',
]);

// NOTE(0913vision): The preload rejects a failed call or a malformed reply;
// it is reported like a refusal.
function rejected(error: unknown): {
  readonly ok: false;
  readonly error: {readonly reason: 'invalid'; readonly message: string};
} {
  const message = error instanceof Error ? error.message : String(error);
  return {ok: false, error: {reason: 'invalid', message}};
}

interface PlaylistChange {
  readonly name?: string;
  readonly items?: readonly MediaId[];
}

function playlistUpdate(
  {value}: MediaDocument,
  playlist: ChosenPlaylist,
  change: PlaylistChange,
) {
  if (playlist.kind === 'media') {
    const found = value.playlists.find(({id}) => id === playlist.id);
    return found === undefined
      ? null
      : ({kind: 'media', value: {...found, ...change}} as const);
  }
  const found = value.audioPlaylists.find(({id}) => id === playlist.id);
  return found === undefined
    ? null
    : ({kind: 'audio', value: {...found, ...change}} as const);
}

function warning(key: string, title: string, meta?: readonly string[]): Notice {
  return {
    key,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    meta,
  };
}

/**
 * Follows main's media list, the copies in progress, and the files main can't
 * find, for the media view; and starts imports, cancels them, and relinks
 * files. A failed import, a refused relink, or a list that can't load is
 * reported as a notice.
 */
export class MediaLibrary {
  private view: MediaLibraryView = EMPTY;
  private readonly active = new Map<MediaId, CopyJob>();
  private readonly listeners = new Set<() => void>();

  private onProblem: (notice: Notice) => void = () => undefined;
  private relinking = false;
  private unsavedRenameRevision: number | null = null;

  constructor(private readonly api: MediaApi) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): MediaLibraryView => this.view;

  /**
   * Reads the list and follows main's pushes, reporting problems to the
   * handler until it stops.
   *
   * @returns A function that stops following them. Always call it.
   */
  start(onProblem: (notice: Notice) => void): () => void {
    let following = true;
    let missingPushed = false;
    let stampsPushed = false;
    this.onProblem = onProblem;
    const {media} = this.api;
    const stops = [
      media.subscribe(document => {
        if (following) this.accept(document);
      }),
      media.subscribeImports(progress => {
        if (following) this.follow(progress);
      }),
      media.subscribeMissing(missing => {
        missingPushed = true;
        if (following) this.setMissing(missing);
      }),
      media.subscribeStamps(stamps => {
        stampsPushed = true;
        if (following) this.setStamps(stamps);
      }),
    ];
    media.get().then(
      document => {
        if (following) this.accept(document);
      },
      () => {
        if (following) {
          this.onProblem(warning('media-view:load', '미디어 불러오기 실패'));
        }
      },
    );
    // NOTE(0913vision): A push is newer than the first reply, which can
    // arrive after it.
    media.missing().then(
      missing => {
        if (following && !missingPushed) this.setMissing(missing);
      },
      () => undefined,
    );
    media.stamps().then(
      stamps => {
        if (following && !stampsPushed) this.setStamps(stamps);
      },
      () => undefined,
    );
    return () => {
      following = false;
      for (const stop of stops) stop();
      this.active.clear();
      this.update({jobs: [], destinations: new Map()});
    };
  }

  /** 가져오기: the file dialog, then a copy job per chosen file. */
  import(
    playlist: MediaImportRequest['playlist'],
  ): Promise<readonly MediaImportProgress[] | null> {
    return this.importSource({kind: 'dialog'}, playlist);
  }

  /** Imports the first bounded batch of native dropped files into the chosen list. */
  async importFiles(
    files: readonly File[],
    playlist: MediaImportRequest['playlist'],
  ): Promise<readonly MediaImportProgress[] | null> {
    const paths = files
      .slice(0, MEDIA_LIMITS.importBatch)
      .map(file => this.api.media.pathForFile(file))
      .filter(path => path !== '');
    if (paths.length === 0) {
      this.onProblem(warning('media-view:import', '미디어 가져오기 실패'));
      return null;
    }
    return this.importSource({kind: 'files', paths}, playlist);
  }

  private async importSource(
    source: MediaImportRequest['source'],
    playlist: MediaImportRequest['playlist'],
  ): Promise<readonly MediaImportProgress[] | null> {
    const result = await requestMediaImport({
      api: this.api,
      source,
      playlist,
      onProblem: notice => this.onProblem(notice),
    });
    if (result === null) return null;
    for (const progress of result) this.follow(progress);
    if (playlist === null) return result;
    // NOTE(0913vision): Only jobs that wait or run get a destination, so the
    // map never outgrows the active jobs, which are capped.
    const destinations = new Map(this.view.destinations);
    for (const {mediaId} of result) {
      if (this.active.has(mediaId)) destinations.set(mediaId, playlist.id);
    }
    this.update({destinations});
    return result;
  }

  /**
   * 새 재생목록, or 새 오디오 재생목록: main names it.
   *
   * @returns The new playlist's id, or null when it was refused.
   */
  async createPlaylist(kind: 'media' | 'audio'): Promise<string | null> {
    const result = await this.api.media
      .edit({type: 'media.playlist.create', kind})
      .catch(rejected);
    if (result.ok) return result.value?.id ?? null;
    if (result.error.reason === 'write-failed') return result.error.applied.id;
    this.refused('Creating a playlist was refused', result.error.message);
    this.onProblem(warning('media-view:playlist', '재생목록 만들기 실패'));
    return null;
  }

  /**
   * 복제 of a media entry: main adds a second entry on the same file with the
   * copy name, right after the original.
   *
   * @returns The copy's id, or null when it was refused.
   */
  async duplicateMedia(mediaId: MediaId): Promise<string | null> {
    const result = await this.api.media
      .edit({type: 'media.duplicate', mediaId})
      .catch(rejected);
    if (result.ok) return result.value?.id ?? null;
    if (result.error.reason === 'write-failed') return result.error.applied.id;
    this.refused('Copying the media was refused', result.error.message);
    this.onProblem(warning('media-view:duplicate', '미디어 복제 실패'));
    return null;
  }

  /**
   * 복제 of a playlist: the same media ids under the copy name.
   *
   * @returns The copy's id, or null when it was refused.
   */
  async duplicatePlaylist(playlist: ChosenPlaylist): Promise<string | null> {
    const result = await this.api.media
      .edit({
        type: 'media.playlist.duplicate',
        playlist:
          playlist.kind === 'media'
            ? {kind: 'media', id: playlist.id}
            : {kind: 'audio', id: playlist.id},
      })
      .catch(rejected);
    if (result.ok) return result.value?.id ?? null;
    if (result.error.reason === 'write-failed') return result.error.applied.id;
    this.refused('Copying the playlist was refused', result.error.message);
    this.onProblem(
      warning('media-view:playlist-duplicate', '재생목록 복제 실패'),
    );
    return null;
  }

  /**
   * 이름 바꾸기 of a playlist, at the list's current revision. A blank or
   * unchanged name changes nothing.
   */
  async renamePlaylist(
    playlist: ChosenPlaylist,
    name: string,
  ): Promise<boolean> {
    const document = this.view.document;
    const current = chosenPlaylist(document, playlist);
    const trimmed = name.trim();
    if (
      document === null ||
      current === null ||
      trimmed === '' ||
      trimmed.length > MEDIA_LIMITS.name
    ) {
      return false;
    }
    if (trimmed === current.name && this.unsavedRenameRevision === null) {
      return true;
    }
    if (
      await this.updatePlaylist(document, playlist, {
        change: {name: trimmed},
        completion: 'saved',
      })
    ) {
      return true;
    }
    this.onProblem(
      warning('media-view:playlist-name', '재생목록 이름 바꾸기 실패', [
        playlist.name,
      ]),
    );
    return false;
  }

  /** 재생목록에서 빼기: the media leaves the playlist and stays in 모든 미디어. */
  async removeFromPlaylist(
    playlist: ChosenPlaylist,
    mediaId: MediaId,
    name: string,
  ): Promise<void> {
    const document = this.view.document;
    const current = chosenPlaylist(document, playlist);
    if (document === null || !current?.items.includes(mediaId)) {
      return;
    }
    const items = current.items.filter(id => id !== mediaId);
    if (await this.updatePlaylist(document, playlist, {change: {items}})) {
      return;
    }
    this.onProblem(
      warning(`media-view:leave:${mediaId}`, '재생목록에서 빼기 실패', [name]),
    );
  }

  /**
   * 삭제 of a media item: it leaves the media list and every playlist; its
   * file stays where it is.
   *
   * @returns Whether it went.
   */
  async deleteMedia(mediaId: MediaId, name: string): Promise<boolean> {
    const result = await this.api.media
      .edit({type: 'media.delete', mediaId})
      .catch(rejected);
    if (result.ok || result.error.reason === 'write-failed') return true;
    this.refused('Deleting media was refused', result.error.message);
    this.onProblem(
      warning(`media-view:delete:${mediaId}`, '미디어 삭제 실패', [name]),
    );
    return false;
  }

  private async updatePlaylist(
    document: MediaDocument,
    playlist: ChosenPlaylist,
    input: {
      readonly change: PlaylistChange;
      readonly completion?: 'applied' | 'saved';
    },
  ): Promise<boolean> {
    const update = playlistUpdate(document, playlist, input.change);
    if (update === null) return true;
    const result = await this.api.media
      .edit({
        type: 'media.playlist.update',
        playlist: update,
        baseRevision: document.revision,
      })
      .catch(rejected);
    if (input.completion === 'saved') {
      if (!result.ok) {
        const revision =
          result.error.reason === 'write-failed'
            ? (result.error.applied.revision ?? document.revision)
            : document.revision;
        this.unsavedRenameRevision = Math.max(
          this.unsavedRenameRevision ?? 0,
          revision,
        );
      } else if (result.value === null) {
        if (this.unsavedRenameRevision !== null) return false;
      } else {
        if (
          this.unsavedRenameRevision !== null &&
          (result.value.revision ?? document.revision) >=
            this.unsavedRenameRevision
        ) {
          this.unsavedRenameRevision = null;
        }
      }
    }
    if (
      result.ok ||
      (result.error.reason === 'write-failed' && input.completion !== 'saved')
    ) {
      return true;
    }
    this.refused('Changing a playlist was refused', result.error.message);
    return false;
  }

  /** 삭제 of a playlist; its media stay in 모든 미디어. */
  async deletePlaylist(playlist: ChosenPlaylist): Promise<boolean> {
    const result = await this.api.media
      .edit({
        type: 'media.playlist.delete',
        playlist:
          playlist.kind === 'media'
            ? {kind: 'media', id: playlist.id}
            : {kind: 'audio', id: playlist.id},
      })
      .catch(rejected);
    if (result.ok || result.error.reason === 'write-failed') return true;
    this.refused('Deleting a playlist was refused', result.error.message);
    this.onProblem(
      warning('media-view:playlist-delete', '재생목록 삭제 실패', [
        playlist.name,
      ]),
    );
    return false;
  }

  /**
   * Changes a media item's playback properties at the list's current
   * revision, keeping the ones it doesn't name.
   */
  async updateProps(mediaId: MediaId, change: MediaProps): Promise<void> {
    const document = this.view.document;
    const item = document?.value.items.find(({id}) => id === mediaId);
    if (document === null || item === undefined) return;
    const result = await this.api.media
      .edit({
        type: 'media.properties.update',
        mediaId,
        changes: {props: {...item.props, ...change}},
        baseRevision: document.revision,
      })
      .catch(rejected);
    if (result.ok || result.error.reason === 'write-failed') return;
    this.refused('Changing media properties was refused', result.error.message);
    this.onProblem(
      warning(`media-view:props:${mediaId}`, '미디어 속성 저장 실패', [
        item.name,
      ]),
    );
  }

  /**
   * 이름 바꾸기 of a media item: its list name changes, its file does not. An
   * empty name, or one that did not change, changes nothing.
   *
   * @returns Whether the name is saved.
   */
  async rename(mediaId: MediaId, name: string): Promise<boolean> {
    const document = this.view.document;
    const item = document?.value.items.find(({id}) => id === mediaId);
    const trimmed = name.trim();
    if (
      document === null ||
      item === undefined ||
      trimmed === '' ||
      trimmed.length > MEDIA_LIMITS.name
    ) {
      return false;
    }
    if (trimmed === item.name) return true;
    const result = await this.api.media
      .edit({
        type: 'media.properties.update',
        mediaId,
        changes: {name: trimmed},
        baseRevision: document.revision,
      })
      .catch(rejected);
    if (result.ok || result.error.reason === 'write-failed') return true;
    this.refused('Renaming media was refused', result.error.message);
    this.onProblem(
      warning(`media-view:rename:${mediaId}`, '미디어 이름 바꾸기 실패', [
        item.name,
      ]),
    );
    return false;
  }

  /** 파일 위치 열기: main shows the file in Explorer, if it is in a media folder. */
  reveal(mediaId: MediaId): void {
    this.api.media.reveal(mediaId);
  }

  /** 복사 멈추기. A job that already ended changes nothing. */
  async cancel(mediaId: MediaId, name: string): Promise<void> {
    const result = await this.api.media
      .edit({type: 'media.import.cancel', mediaId})
      .catch(rejected);
    if (result.ok || result.error.reason === 'not-found') return;
    this.refused('Stopping a media copy was refused', result.error.message);
    this.onProblem(
      warning(`media-view:cancel:${mediaId}`, '복사 멈추기 실패', [name]),
    );
  }

  /**
   * 다시 연결: the file dialog for one missing file. A second request while
   * one is open, such as the second click of a double click, does nothing.
   */
  async relink(mediaId: MediaId, name: string): Promise<void> {
    if (this.relinking) return;
    this.relinking = true;
    try {
      const result = await this.api.media
        .edit({type: 'media.relink', mediaId})
        .catch(rejected);
      if (result.ok || result.error.reason === 'write-failed') return;
      this.refused('Relinking media was refused', result.error.message);
      this.onProblem(
        warning(`media-view:relink:${mediaId}`, '다시 연결 실패', [name]),
      );
    } finally {
      this.relinking = false;
    }
  }

  private refused(message: string, detail: string): void {
    this.api.log.write({level: 'warn', message, detail});
  }

  private accept(document: MediaDocument): void {
    if (document.revision <= (this.view.document?.revision ?? -1)) return;
    this.update({document});
  }

  private follow(progress: MediaImportProgress): void {
    const failure = mediaImportFailureNotice(progress);
    if (failure) this.onProblem(failure);
    if (updateActiveCopies(this.active, progress)) {
      this.update({jobs: [...this.active.values()]});
    }
    if (
      ENDED.has(progress.phase) &&
      this.view.destinations.has(progress.mediaId)
    ) {
      const destinations = new Map(this.view.destinations);
      destinations.delete(progress.mediaId);
      this.update({destinations});
    }
  }

  private setStamps(stamps: MediaStamps): void {
    noteThumbnailStamps(stamps);
    this.update({});
  }

  private setMissing(missing: MissingMedia): void {
    this.update({missing: new Set(missing)});
  }

  private update(change: Partial<MediaLibraryView>): void {
    if (change.document !== undefined && change.document !== null) {
      noteThumbnailItems(change.document.value.items);
    }
    this.view = {...this.view, ...change};
    for (const listener of this.listeners) listener();
  }
}
