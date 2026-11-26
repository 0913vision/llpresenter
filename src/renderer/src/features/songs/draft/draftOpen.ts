import {createSongId, type SongId} from '@core/schema/common/ids';
import type {SongDocument} from '@core/schema/services/contentDocuments';
import {SONG_SCHEMA_VERSION, type Song} from '@core/schema/songs/song';
import type {TextImportDraft} from '@core/schema/songs/textImport';
import type {Slide} from '@core/schema/slides/slide';
import {newSongSlides, songItemBody, songSlides} from '@core/slides';
import {normalizeSongTitle} from '@core/songs';
import {slideMaking} from '@renderer/platform/documents/themes';
import {editingSong, freshDraft, type SongDraft} from '../songDraftModel';
import {editSong, resumeSongHistory} from './draftHistory';
import {
  draftView as view,
  useSongDraft,
  type ImportPictures,
} from './draftStore';

const NEW_SONG_TITLE = '새 곡';
const IMPORTED_TITLE = '가져온 곡';

/** Opens `song` with a history of its own, and drops what was open. */
export function show(
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

/**
 * The drafts of songs deleted while they were open, each with its changes and
 * steps, for when 실행 취소 brings the song back (USER Nov 26, "지우기 전 그대로
 * 되살림").
 */
const parked = new Map<SongId, SongDraft>();

/** Closes the song that was deleted, keeping its draft as it was. */
export function parkSongDraft(): void {
  const {draft} = view();
  if (draft === null) return;
  parked.set(draft.song.id, draft);
  closeSongDraft();
}

/**
 * Opens a song of the library to be edited; a song that was deleted while it
 * was open comes back as it was then, with its unsaved changes and steps.
 */
export function openSongDraft(
  document: SongDocument,
  options: {readonly focusTitle?: boolean | undefined} = {},
): void {
  const kept = parked.get(document.song.id);
  parked.delete(document.song.id);
  if (kept === undefined) show(document.song, document);
  else {
    view().pictures?.source.release();
    useSongDraft.setState({
      draft: {...kept, document},
      pictures: null,
      question: null,
    });
    resumeSongHistory(kept.past.length);
  }
  if (options.focusTitle === true) focusTitle();
}

/**
 * Puts the file of a save under the open draft of the same song and keeps its
 * steps; the song shows as the file has it unless it changed since `saved`
 * was sent. Another song opens anew.
 */
export function settleSongDraft(document: SongDocument, saved: Song): void {
  const {draft} = view();
  if (draft?.song.id !== document.song.id) {
    show(document.song, document);
    return;
  }
  useSongDraft.setState({
    draft: {
      ...draft,
      document,
      song: draft.song === saved ? editingSong(document.song) : draft.song,
    },
  });
}

/**
 * Opens a song of the library with the slides of one of its 예배 순서 items in
 * place of its own, to be checked and saved over the song (USER Nov 25): the
 * song keeps its own title slide, the item's title slides stay out. The change
 * is one step, so 실행 취소 shows the song as the library has it.
 */
export function openSongDraftWithItem(
  document: SongDocument,
  itemSlides: readonly Slide[],
): void {
  show(document.song, document);
  const titles = document.song.titleSlide === undefined ? 0 : 1;
  const body = songItemBody(itemSlides, document.song.title);
  editSong(song => ({
    ...song,
    slides: [...song.slides.slice(0, titles), ...body],
  }));
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
