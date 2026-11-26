import {
  undoTimeline,
  type UndoOwner,
} from '@renderer/platform/undo/undoTimeline';
import type {Song} from '@core/schema/songs/song';
import {withSongTitle} from '@core/slides';
import {amendedDraft, editedDraft, replayedDraft} from '../songDraftModel';
import {draftView as view, useSongDraft} from './draftStore';

/**
 * The open song's steps, as a history of the window's 실행 취소. They are
 * made in the 라이브러리 tab, so they run back only there (USER Nov 25). Its
 * steps go with the draft: a song opened, saved anew or closed starts anew.
 */
export const songUndoHistory: UndoOwner = {
  replay: kind => Promise.resolve(replaySong(kind)),
};
useSongDraft.subscribe((state, before) => {
  const draft = state.draft;
  const prior = before.draft;
  if (draft === prior) return;
  const fresh =
    draft?.song.id !== prior?.song.id ||
    draft === null ||
    (draft.past.length === 0 && draft.future.length === 0);
  if (fresh) undoTimeline.forget(songUndoHistory);
});

/** Puts the steps of a song that came back with its history into the window's 실행 취소. */
export function resumeSongHistory(steps: number): void {
  undoTimeline.resume(songUndoHistory, steps, 'library');
}

/** Changes the song and every step of its history alike. */
export function amend(change: (song: Song) => Song): void {
  const {draft} = view();
  if (draft === null) return;
  useSongDraft.setState({draft: amendedDraft(draft, change)});
}

/** Changes the song that is open. */
export function editSong(change: (song: Song) => Song, key?: string): void {
  const {draft} = view();
  if (draft === null || draft.document?.access === 'readOnly') return;
  const after = change(draft.song);
  if (after === draft.song) return;
  const next = editedDraft(draft, after, {key, time: Date.now()});
  useSongDraft.setState({draft: next});
  // NOTE(0913vision): Typing that goes on in one field stays one step, so
  // only a step of its own is a new step of the window's 실행 취소.
  const goesOn =
    next.past.length === draft.past.length &&
    next.past.at(-1)?.before === draft.past.at(-1)?.before;
  // NOTE(0913vision): A song opens into the 라이브러리 tab from anywhere, and
  // its first step can come before that tab shows.
  if (!goesOn) undoTimeline.record(songUndoHistory, 'library');
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
 * Steps the draft back or forward through its history.
 *
 * @returns Whether there was a step.
 */
export function replaySong(kind: 'undo' | 'redo'): boolean {
  const {draft} = view();
  const replayed = draft === null ? null : replayedDraft(draft, kind);
  if (replayed === null) return false;
  useSongDraft.setState({draft: replayed});
  return true;
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
