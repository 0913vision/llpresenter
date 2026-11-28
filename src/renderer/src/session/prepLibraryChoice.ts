import {create} from 'zustand';
import type {SongId} from '@core/schema/common/ids';

interface PrepLibraryChoice {
  /** The song to choose in 준비's 라이브러리 list; none before the first ask. */
  readonly songId: SongId | null;
  /** Grows on every ask, so the same song can be asked for again. */
  readonly turn: number;
}

/**
 * A song 준비 is asked to show in its left 라이브러리 list, as 실행 취소 brings
 * back the screen a deletion was made on (USER Nov 28).
 */
export const usePrepLibraryChoice = create<PrepLibraryChoice>(() => ({
  songId: null,
  turn: 0,
}));

/** Chooses a song in 준비's 라이브러리 list, with the list on screen. */
export function chooseInPrepLibrary(songId: SongId): void {
  usePrepLibraryChoice.setState(({turn}) => ({songId, turn: turn + 1}));
}
