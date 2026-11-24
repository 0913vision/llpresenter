import {describe, expect, it} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {
  LibrarySong,
  SongDocument,
} from '@core/schema/services/contentDocuments';
import type {Song} from '@core/schema/songs/song';
import {DUPLICATE_TITLE_REASON, EMPTY_TITLE_REASON} from '@core/songs';
import {
  amendedDraft,
  editedDraft,
  freshDraft,
  isUnsaved,
  replayedDraft,
  SONG_HISTORY_LIMIT,
  songTitleProblem,
  TYPING_PAUSE_MS,
} from '@renderer/features/songs/songDraftModel';
import {song} from '@fixtures/core/songs/blockFixtures';

const titled = (base: Song, title: string): Song => ({...base, title});
const fileOf = (value: Song): SongDocument => ({
  song: value,
  revision: 1,
  access: 'editable',
});
const other: LibrarySong = {
  id: createSongId('0b5f7a36-2c41-4d7e-9a8b-1c2d3e4f5a6b'),
  title: '다른 곡',
  slideCount: 3,
  access: 'editable',
  usedBy: [],
};

describe('editing a draft', () => {
  it('records one step per change and clears 다시 실행', () => {
    const start = song();
    const first = editedDraft(freshDraft(start, null), titled(start, 'A'), {
      time: 0,
    });
    const undone = replayedDraft(first, 'undo');
    if (undone === null) throw new Error('No step to undo');
    const second = editedDraft(undone, titled(start, 'B'), {time: 10});
    expect(second.song.title).toBe('B');
    expect(second.past).toHaveLength(1);
    expect(second.future).toEqual([]);
  });

  it('adds typing in the same field within the pause to the last step', () => {
    const start = song();
    const once = editedDraft(freshDraft(start, null), titled(start, 'A'), {
      key: 'title',
      time: 0,
    });
    const twice = editedDraft(once, titled(start, 'AB'), {
      key: 'title',
      time: TYPING_PAUSE_MS - 1,
    });
    expect(twice.past).toHaveLength(1);
    expect(twice.past[0]?.before).toBe(start);
    const later = editedDraft(twice, titled(start, 'ABC'), {
      key: 'title',
      time: TYPING_PAUSE_MS * 2,
    });
    expect(later.past).toHaveLength(2);
  });

  it('keeps only the latest steps', () => {
    let draft = freshDraft(song(), null);
    for (let index = 0; index <= SONG_HISTORY_LIMIT; index++) {
      draft = editedDraft(draft, titled(draft.song, `${index}`), {time: index});
    }
    expect(draft.past).toHaveLength(SONG_HISTORY_LIMIT);
    expect(draft.past[0]?.after.title).toBe('1');
  });
});

describe('실행 취소 and 다시 실행 of a draft', () => {
  it('goes back and forward through the steps, and answers null past the ends', () => {
    const start = song();
    const draft = editedDraft(freshDraft(start, null), titled(start, 'A'), {
      time: 0,
    });
    const undone = replayedDraft(draft, 'undo');
    expect(undone?.song).toBe(start);
    expect(undone && replayedDraft(undone, 'undo')).toBeNull();
    const redone = undone && replayedDraft(undone, 'redo');
    expect(redone?.song.title).toBe('A');
    expect(redone && replayedDraft(redone, 'redo')).toBeNull();
  });

  it('makes a change to the song and to every step alike', () => {
    const start = song();
    const draft = editedDraft(freshDraft(start, null), titled(start, 'A'), {
      time: 0,
    });
    const upper = amendedDraft(draft, value =>
      titled(value, `${value.title}!`),
    );
    expect(upper.song.title).toBe('A!');
    expect(upper.past[0]?.before.title).toBe('새 아침!');
    expect(upper.past[0]?.after.title).toBe('A!');
  });
});

describe('a draft against its file and the library', () => {
  it('is unsaved without a file or with changes the file lacks', () => {
    const start = song();
    const document = fileOf(start);
    expect(isUnsaved(freshDraft(start, null))).toBe(true);
    expect(isUnsaved(freshDraft(start, document))).toBe(false);
    expect(isUnsaved(freshDraft(titled(start, 'B'), document))).toBe(true);
  });

  it('refuses an empty title, and a saved song taking another song’s title', () => {
    const start = song();
    const document = fileOf(start);
    expect(songTitleProblem(freshDraft(titled(start, '  '), null), [])).toBe(
      EMPTY_TITLE_REASON,
    );
    expect(
      songTitleProblem(freshDraft(titled(start, '다른 곡'), document), [other]),
    ).toBe(DUPLICATE_TITLE_REASON);
    expect(songTitleProblem(freshDraft(start, document), [other])).toBe(
      undefined,
    );
  });
});
