import {create} from 'zustand';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  LibrarySong,
  SongDocument,
} from '@core/schema/services/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/services/contentEdit';
import {createSongId, type MediaId, type SongId} from '@core/schema/common/ids';
import {SONG_SCHEMA_VERSION, type Song} from '@core/schema/songs/song';
import type {TextImportDraft} from '@core/schema/songs/textImport';
import {newSongSlides, songSlides, withSongTitle} from '@core/slides';
import {
  copyTitle,
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
} from '@core/songs';
import {pendingWritesOf} from '@renderer/platform/documents/pendingWrites';
import {slideMaking} from '@renderer/platform/documents/themes';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {
  amendedDraft,
  editedDraft,
  freshDraft,
  isUnsaved,
  replayedDraft,
  songTitleProblem,
  type SongDraft,
} from './songDraftModel';

const NEW_SONG_TITLE = '새 곡';
const IMPORTED_TITLE = '가져온 곡';

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

type Api = Pick<LlpApi, 'songs' | 'content' | 'log'>;
let report: (notice: Notice) => void = () => undefined;
let api: Api | undefined;

function problem(title: string): void {
  report({
    key: `song:${title}`,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
  });
}

const view = () => useSongDraft.getState();

function show(
  song: Song,
  document: SongDocument | null,
  imported = false,
): void {
  view().pictures?.source.release();
  useSongDraft.setState({
    draft: freshDraft(song, document, imported),
    pictures: null,
    question: null,
  });
}

/** Opens a song of the library to be edited. */
export function openSongDraft(
  document: SongDocument,
  options: {readonly focusTitle?: boolean | undefined} = {},
): void {
  show(document.song, document);
  if (options.focusTitle === true) focusTitle();
}

function focusTitle(): void {
  useSongDraft.setState(({titleFocus}) => ({titleFocus: titleFocus + 1}));
}

function unsavedSong(title: string, slides: Song['slides']): Song {
  return {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId(crypto.randomUUID()),
    title,
    slides,
  };
}

/** Starts a song that the library gets when it is saved. */
export function openNewSong(): void {
  show(
    unsavedSong(NEW_SONG_TITLE, newSongSlides(slideMaking(), NEW_SONG_TITLE)),
    null,
  );
  focusTitle();
}

/** Opens a song that was read from a file or the clipboard. */
export function openImportedSong(
  draft: TextImportDraft,
  pictures?: ImportPictures,
): void {
  const title = normalizeSongTitle(draft.title) || IMPORTED_TITLE;
  const slides = songSlides(slideMaking(), draft);
  show(
    unsavedSong(
      title,
      draft.preserveSlides === true
        ? slides
        : [...newSongSlides(slideMaking(), title).slice(0, 1), ...slides],
    ),
    null,
    true,
  );
  if (pictures !== undefined) {
    useSongDraft.setState({pictures: {source: pictures, busy: true}});
  }
  focusTitle();
}

/** Closes the draft and frees the pictures of its import. */
export function closeSongDraft(): void {
  view().pictures?.source.release();
  useSongDraft.setState({draft: null, pictures: null, question: null});
}

/** Changes the song and every step of its history alike. */
function amend(change: (song: Song) => Song): void {
  const {draft} = view();
  if (draft === null) return;
  useSongDraft.setState({draft: amendedDraft(draft, change)});
}

/** Null takes the picture away. */
type Replacements = ReadonlyMap<MediaId, MediaId | null>;

function withPictures(song: Song, pictures: Replacements): Song {
  return {
    ...song,
    slides: song.slides.map(slide => {
      const {background, ...rest} = slide;
      if (background?.kind !== 'media') return slide;
      const picture = pictures.get(background.media);
      if (picture === undefined) return slide;
      return picture === null
        ? rest
        : {...slide, background: {...background, media: picture}};
    }),
  };
}

/** Puts pictures that came in where others stood in for them. */
export function replaceImportedPictures(
  source: ImportPictures,
  pictures: Replacements,
): void {
  if (view().pictures?.source !== source) return;
  amend(song => withPictures(song, pictures));
}

/** No more pictures come in. */
export function finishImportedPictures(source: ImportPictures): void {
  if (view().pictures?.source !== source) return;
  useSongDraft.setState({pictures: {source, busy: false}});
}

/** The song with the files of the pictures it was imported with. */
async function withPictureFiles(song: Song): Promise<Song> {
  const source = view().pictures?.source;
  if (source === undefined) return song;
  const files = await source.keep(
    new Set(
      song.slides.flatMap(({background}) =>
        background?.kind === 'media' ? [background.media] : [],
      ),
    ),
    song.title,
  );
  return withPictures(song, files);
}

/** Changes the song that is open. */
export function editSong(change: (song: Song) => Song, key?: string): void {
  const {draft} = view();
  if (draft === null || draft.document?.access === 'readOnly') return;
  const after = change(draft.song);
  if (after === draft.song) return;
  useSongDraft.setState({
    draft: editedDraft(draft, after, {key, time: Date.now()}),
  });
}

/** Renames the song, and the title slide that shows its name. */
export function editSongTitle(title: string): void {
  editSong(
    song => ({
      ...song,
      title,
      slides: withSongTitle(song.slides, song.title, title),
    }),
    'title',
  );
}

/**
 * Steps the draft back or forward through its history; nothing when there is no
 * step.
 */
export function replaySong(kind: 'undo' | 'redo'): void {
  const {draft} = view();
  const replayed = draft === null ? null : replayedDraft(draft, kind);
  if (replayed !== null) useSongDraft.setState({draft: replayed});
}

async function send(edit: ContentEdit): Promise<EditResult | null> {
  if (api === undefined) return null;
  try {
    return await api.content.edit(edit);
  } catch (error) {
    api.log.write({
      level: 'error',
      message: 'Could not save a song',
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** The song a save made or changed, even when its file is not written yet. */
function savedId(result: EditResult | null): SongId | undefined {
  if (result === null) return undefined;
  if (result.ok) return createSongId(result.value.id);
  return result.error.reason === 'write-failed'
    ? createSongId(result.error.applied.id)
    : undefined;
}

async function guarded(work: () => Promise<boolean>): Promise<boolean> {
  if (view().saving) return false;
  useSongDraft.setState({saving: true});
  try {
    return await work();
  } finally {
    useSongDraft.setState({saving: false});
  }
}

async function reopen(id: SongId): Promise<boolean> {
  const document = (await api?.songs.get(id)) ?? null;
  if (document === null) {
    problem('저장한 곡 불러오기 실패');
    return false;
  }
  show(document.song, document);
  return true;
}

function sent(draft: SongDraft): Song {
  return {...draft.song, title: normalizeSongTitle(draft.song.title)};
}

/** Saves a song that the library has over its file. */
export function overwriteSong(): Promise<boolean> {
  return guarded(async () => {
    const {draft} = view();
    if (draft?.document == null) return false;
    const result = await send({
      type: 'song.update',
      song: sent(draft),
      baseRevision: draft.document.revision,
    });
    const id = savedId(result);
    if (id === undefined) {
      problem(
        result?.ok === false && result.error.reason === 'duplicate-title'
          ? DUPLICATE_TITLE_REASON
          : '곡 저장 실패',
      );
      return false;
    }
    if (result?.ok === false) problem('곡 파일 저장 실패');
    return reopen(id);
  });
}

/** Saves a song that is not in the library yet, or over one that is. */
export function saveNewSong(
  target: Extract<ContentEdit, {type: 'song.import'}>['target'],
): Promise<boolean> {
  return guarded(async () => {
    const {draft} = view();
    if (draft === null) return false;
    let song: Song;
    try {
      song = await withPictureFiles(sent(draft));
    } catch (error) {
      console.error('Could not keep the pictures of a song', error);
      problem('배경 가져오기 실패');
      return false;
    }
    const {title, slides} = song;
    const result = await send({
      type: 'song.import',
      target,
      draft: {title, slides},
    });
    const id = savedId(result);
    if (id === undefined) {
      problem('곡 저장 실패');
      return false;
    }
    if (result?.ok === false) problem('곡 파일 저장 실패');
    return reopen(id);
  });
}

/** Saves the open song as another one, which stays open. */
export function saveSongAs(title: string): Promise<boolean> {
  return guarded(async () => {
    const {draft} = view();
    if (draft === null) return false;
    const {song} = draft;
    const result = await send({
      type: 'song.saveAs',
      song: {
        ...song,
        title,
        slides: withSongTitle(song.slides, song.title, title),
      },
    });
    const id = savedId(result);
    if (id === undefined) {
      problem('다른 이름으로 저장 실패');
      return false;
    }
    return reopen(id);
  });
}

/** Saves the open song, asking first when another song would be replaced. */
export async function requestSave(): Promise<boolean> {
  const {draft, library, libraryStatus, pictures} = view();
  if (
    draft === null ||
    pictures?.busy === true ||
    songTitleProblem(draft, library) !== undefined
  ) {
    return false;
  }
  if (draft.document !== null) {
    if (isUnsaved(draft)) ask({kind: 'overwrite'});
    return false;
  }
  if (libraryStatus !== 'ready') return false;
  const title = normalizeSongTitle(draft.song.title);
  const taken = library.find(
    entry => normalizeSongTitle(entry.title) === title,
  );
  const document =
    taken === undefined ? null : ((await api?.songs.get(taken.id)) ?? null);
  if (document === null) return saveNewSong({kind: 'new'});
  ask({kind: 'taken', document});
  return false;
}

/**
 * Shows `question`, or closes the open one with null; a pending 'leave'
 * question that is replaced is cancelled.
 */
export function ask(question: SongQuestion | null): void {
  const before = view().question;
  if (before?.kind === 'leave' && question?.kind !== 'leave') {
    before.cancel?.();
  }
  useSongDraft.setState({question});
}

/** Goes on once the open song may be left, asking about unsaved changes. */
export function requestLeaveSong(
  proceed: () => void,
  cancel?: () => void,
): void {
  const {draft} = view();
  const untouched =
    draft !== null &&
    draft.document === null &&
    !draft.imported &&
    draft.past.length === 0;
  if (draft === null || untouched || !isUnsaved(draft)) {
    closeSongDraft();
    proceed();
    return;
  }
  ask({kind: 'leave', proceed, cancel});
}

/** The name 다른 이름으로 저장 starts with. */
export function suggestedCopyTitle(): string {
  const {draft, library} = view();
  return copyTitle(
    draft?.song.title ?? '',
    library.map(entry => entry.title),
  );
}

/** Follows a rename of a label in slides that are not saved yet. */
export function renameDraftLabel(from: string, to: string): void {
  amend(song => ({
    ...song,
    slides: song.slides.map(slide =>
      slide.label === from ? {...slide, label: to} : slide,
    ),
  }));
}

/**
 * Follows the library, and asks about the open song before the window closes.
 *
 * @returns A function that stops following. Always call it.
 */
export function startSongDraftSync(
  window: LlpApi | undefined,
  onProblem: (notice: Notice) => void,
): () => void {
  if (window === undefined) return () => undefined;
  api = window;
  report = onProblem;
  let stopped = false;
  const accept = (library: readonly LibrarySong[]): void => {
    if (!stopped) useSongDraft.setState({library, libraryStatus: 'ready'});
  };
  const stops = [
    window.songs.subscribeList(accept),
    window.songs.subscribe(({songId, document}) => {
      const {draft} = view();
      if (draft?.document == null || draft.song.id !== songId) return;
      if (document === null) {
        if (!isUnsaved(draft)) closeSongDraft();
        return;
      }
      if (document.revision <= draft.document.revision) return;
      // NOTE(0913vision): A draft with changes keeps them and saves over the
      // newer file; one without follows the file.
      if (isUnsaved(draft)) {
        useSongDraft.setState({draft: {...draft, document}});
      } else show(document.song, document);
    }),
    pendingWritesOf(window).addDraft(
      () =>
        new Promise(resolve => {
          requestLeaveSong(
            () => resolve('settled'),
            () => resolve('canceled'),
          );
        }),
      error => console.error('Could not settle the song draft', error),
    ),
  ];
  window.songs.list().then(accept, () => {
    if (!stopped) useSongDraft.setState({libraryStatus: 'failed'});
  });
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}
