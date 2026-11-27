import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {
  useLibraryPanels,
  usePrepPanels,
} from '@renderer/app/workspaces/prepPanels';
import {closeSongDraft, openSongDraft} from '@renderer/features/songs/draft';
import {closePrepEditor} from '@renderer/session/prepTarget';
import {lyricsSlide} from '@fixtures/core/slides';

afterEach(() => {
  closeSongDraft();
  closePrepEditor();
});

function openSong(): void {
  openSongDraft({
    song: {
      format: 'llsong',
      schemaVersion: SONG_SCHEMA_VERSION,
      id: createSongId('00000000-0000-4000-8000-000000000201'),
      title: '주만 바라볼지라',
      slides: [lyricsSlide(1, '가사')],
    },
    revision: 1,
    access: 'editable',
  });
}

it('keeps the 라이브러리 columns with an empty editor when the open song is deleted, never the 예배 순서, so 실행 취소 can bring it back', () => {
  act(openSong);
  const view = renderHook(() =>
    useLibraryPanels({prep: undefined, onProblem: undefined}),
  );
  expect(view.result.current.editing).toBe(true);
  // NOTE(0913vision): A song deleted while it is open closes its draft alone,
  // as here.
  act(closeSongDraft);
  view.rerender();
  expect(view.result.current.columns.flat()).toEqual([
    '라이브러리',
    '편집',
    '슬라이드 속성',
  ]);
  expect(view.result.current.editing).toBe(false);
});

it('leaves 준비 to the 예배 순서 and its items while a library song is open in 라이브러리 (USER Nov 27)', () => {
  act(openSong);
  const view = renderHook(() =>
    usePrepPanels({
      prep: undefined,
      target: null,
      sizeClass: 'wide',
      onProblem: undefined,
      onOpenPrep: undefined,
      onShowInLibrary: undefined,
    }),
  );
  expect(view.result.current.columns.flat()).toEqual([
    '라이브러리',
    '예배 순서',
    '세부정보',
  ]);
  expect(view.result.current.editing).toBe(false);
});
