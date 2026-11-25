import {create} from 'zustand';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  LibrarySong,
  SongDocument,
} from '@core/schema/services/contentDocuments';
import type {MediaId} from '@core/schema/common/ids';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import type {SongDraft} from '../songDraftModel';

/** Pictures that an imported song shows before they are files of the list. */
export interface ImportPictures {
  /** The files of these pictures, made where the media list has none. */
  readonly keep: (
    ids: ReadonlySet<MediaId>,
    title: string,
  ) => Promise<ReadonlyMap<MediaId, MediaId>>;
  /** Stops what still comes in and frees the rest. */
  readonly release: () => void;
}

/** What is asked before the draft is saved or left. */
export type SongQuestion =
  | {readonly kind: 'overwrite'}
  | {readonly kind: 'saveAs'}
  | {readonly kind: 'taken'; readonly document: SongDocument}
  | {
      readonly kind: 'leave';
      readonly proceed: () => void;
      readonly cancel?: (() => void) | undefined;
    };

/**
 * The state of the song editor: the open draft, the pictures of an import, the
 * question being asked, whether it saves, and the library's songs.
 */
export interface SongDraftView {
  readonly draft: SongDraft | null;
  /** The pictures of the import that is open, and whether more come in. */
  readonly pictures: {
    readonly source: ImportPictures;
    readonly busy: boolean;
  } | null;
  readonly question: SongQuestion | null;
  readonly saving: boolean;
  readonly library: readonly LibrarySong[];
  readonly libraryStatus: 'loading' | 'ready' | 'failed';
  /** Grows whenever the title field should take the focus. */
  readonly titleFocus: number;
}

/** The store of the song being edited. */
export const useSongDraft = create<SongDraftView>(() => ({
  draft: null,
  pictures: null,
  question: null,
  saving: false,
  library: [],
  libraryStatus: 'loading',
  titleFocus: 0,
}));

/** What the song editor saves with and reports to, once the window is up. */
export type SongDraftApi = Pick<LlpApi, 'songs' | 'content' | 'log'>;

let connection:
  | {readonly api: SongDraftApi; readonly report: (notice: Notice) => void}
  | undefined;

/** Gives the song editor its app connection and notice list. */
export function connectSongDraft(
  api: SongDraftApi,
  report: (notice: Notice) => void,
): void {
  connection = {api, report};
}

/** The app connection, none before the window is up. */
export function songDraftApi(): SongDraftApi | undefined {
  return connection?.api;
}

/** Tells the operator that something about the song failed. */
export function songProblem(title: string, meta: readonly string[] = []): void {
  connection?.report({
    key: `song:${title}`,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    ...(meta.length === 0 ? {} : {meta}),
  });
}

/** The editor's state now. */
export function draftView(): SongDraftView {
  return useSongDraft.getState();
}
