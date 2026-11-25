import {logFailure} from '@renderer/platform/logFailure';
import type {ContentEdit, EditResult} from '@core/schema/services/contentEdit';
import {createSongId, type SongId} from '@core/schema/common/ids';
import type {Song} from '@core/schema/songs/song';
import {withSongTitle} from '@core/slides';
import {
  copyTitle,
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
} from '@core/songs';
import {isUnsaved, songTitleProblem, type SongDraft} from '../songDraftModel';
import {show} from './draftOpen';
import {withPictureFiles} from './draftPictures';
import {ask} from './draftQuestions';
import {
  draftView as view,
  songDraftApi,
  songProblem as problem,
  useSongDraft,
} from './draftStore';
import {failureReasonLines} from '@renderer/platform/problemReasons';

async function send(edit: ContentEdit): Promise<EditResult | null> {
  const api = songDraftApi();
  if (api === undefined) return null;
  try {
    return await api.content.edit(edit);
  } catch (error) {
    logFailure(api, 'Could not save a song', error);
    return null;
  }
}

/** Why a save was refused or not written; none when the request itself failed. */
function why(result: EditResult | null): readonly string[] {
  return result?.ok === false ? failureReasonLines(result.error.reason) : [];
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
  const document = (await songDraftApi()?.songs.get(id)) ?? null;
  if (document === null) {
    problem('저장한 곡 불러오기 실패');
    return false;
  }
  show(document.song, document);
  return true;
}

// NOTE(0913vision): The draft keeps the title slide first among the slides;
// main keeps it apart in the file (`withSongSlides`), for every way a song is
// saved.
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
      if (result?.ok === false && result.error.reason === 'duplicate-title') {
        problem(DUPLICATE_TITLE_REASON);
      } else problem('곡 저장 실패', why(result));
      return false;
    }
    if (result?.ok === false) problem('곡 파일 저장 실패', why(result));
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
      problem('곡 저장 실패', why(result));
      return false;
    }
    if (result?.ok === false) problem('곡 파일 저장 실패', why(result));
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
      problem('다른 이름으로 저장 실패', why(result));
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
    taken === undefined
      ? null
      : ((await songDraftApi()?.songs.get(taken.id)) ?? null);
  if (document === null) return saveNewSong({kind: 'new'});
  ask({kind: 'taken', document});
  return false;
}

/** The name 다른 이름으로 저장 starts with. */
export function suggestedCopyTitle(): string {
  const {draft, library} = view();
  return copyTitle(
    draft?.song.title ?? '',
    library.map(entry => entry.title),
  );
}
