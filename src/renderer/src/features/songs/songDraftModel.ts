import {sameJson} from '@core/common/sameJson';
import type {
  LibrarySong,
  SongDocument,
} from '@core/schema/services/contentDocuments';
import type {Song} from '@core/schema/songs/song';
import {
  importLimitReason,
  DUPLICATE_TITLE_REASON,
  EMPTY_TITLE_REASON,
  normalizeSongTitle,
  SONG_TITLE_LIMIT,
} from '@core/songs';

/** How many steps 실행 취소 can go back in a draft. */
export const SONG_HISTORY_LIMIT = 100;
/** Typing in one field within this pause is one step, in milliseconds. */
export const TYPING_PAUSE_MS = 1500;

/** One change of a draft: the song before and after it. */
export interface SongStep {
  readonly before: Song;
  readonly after: Song;
  /** The field typed in; typing in it again soon adds to this step. */
  readonly key?: string | undefined;
  readonly time: number;
}

/** A song of the library that is being edited, until it is saved. */
export interface SongDraft {
  readonly song: Song;
  /** What its file has; none for a song that was never saved. */
  readonly document: SongDocument | null;
  /** It was read from a file or the clipboard, and is lost unless it is saved. */
  readonly imported: boolean;
  readonly past: readonly SongStep[];
  readonly future: readonly SongStep[];
}

/** A draft of `song` with no history. */
export function freshDraft(
  song: Song,
  document: SongDocument | null,
  imported = false,
): SongDraft {
  return {song, document, imported, past: [], future: []};
}

/** Whether a draft has changes its file does not have. */
export function isUnsaved(draft: SongDraft): boolean {
  return draft.document === null || !sameJson(draft.song, draft.document.song);
}

/** Why a draft can't have its title. */
export function songTitleProblem(
  draft: SongDraft,
  library: readonly LibrarySong[],
): string | undefined {
  const title = normalizeSongTitle(draft.song.title);
  if (title === '') return EMPTY_TITLE_REASON;
  if (draft.document === null) {
    return title.length > SONG_TITLE_LIMIT
      ? '곡 제목이 너무 깁니다.'
      : importLimitReason(draft.song);
  }
  return library.some(
    entry =>
      entry.id !== draft.song.id && normalizeSongTitle(entry.title) === title,
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
}

/**
 * The draft with `after` as its song and one more step, which clears what
 * 다시 실행 had. Typing in the same field within {@link TYPING_PAUSE_MS} adds to
 * the last step instead.
 */
export function editedDraft(
  draft: SongDraft,
  after: Song,
  {key, time}: {readonly key?: string | undefined; readonly time: number},
): SongDraft {
  const last = draft.past.at(-1);
  const goesOn =
    key !== undefined &&
    last?.key === key &&
    time - last.time < TYPING_PAUSE_MS;
  const step: SongStep = {
    before: goesOn ? last.before : draft.song,
    after,
    key,
    time,
  };
  return {
    ...draft,
    song: after,
    past: [...(goesOn ? draft.past.slice(0, -1) : draft.past), step].slice(
      -SONG_HISTORY_LIMIT,
    ),
    future: [],
  };
}

/** The draft one step back or forward; null when there is no step. */
export function replayedDraft(
  draft: SongDraft,
  kind: 'undo' | 'redo',
): SongDraft | null {
  const step = (kind === 'undo' ? draft.past : draft.future).at(-1);
  if (step === undefined) return null;
  return kind === 'undo'
    ? {
        ...draft,
        song: step.before,
        past: draft.past.slice(0, -1),
        future: [...draft.future, step],
      }
    : {
        ...draft,
        song: step.after,
        past: [...draft.past, step],
        future: draft.future.slice(0, -1),
      };
}

/** The draft with `change` made to its song and to every step of its history. */
export function amendedDraft(
  draft: SongDraft,
  change: (song: Song) => Song,
): SongDraft {
  const amended = (step: SongStep): SongStep => ({
    ...step,
    before: change(step.before),
    after: change(step.after),
  });
  return {
    ...draft,
    song: change(draft.song),
    past: draft.past.map(amended),
    future: draft.future.map(amended),
  };
}
