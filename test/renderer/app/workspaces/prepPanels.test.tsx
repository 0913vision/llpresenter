import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {usePrepPanels} from '@renderer/app/workspaces/prepPanels';
import {workspaceTabOf} from '@renderer/app/useWorkspaceTabs';
import {closeSongDraft, openSongDraft} from '@renderer/features/songs/draft';
import {
  closePrepEditor,
  openInPrep,
  usePrepTarget,
} from '@renderer/session/prepTarget';
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
  openInPrep({kind: 'song'});
}

/** The 준비 panels for what the prep target says now. */
function panels() {
  return renderHook(() =>
    usePrepPanels({
      prep: undefined,
      target: usePrepTarget(view => view.target),
      sizeClass: 'wide',
      onProblem: undefined,
      onOpenPrep: undefined,
      onShowInLibrary: undefined,
    }),
  );
}

it('keeps the 라이브러리 columns with an empty editor when the open song is deleted, never the 예배 순서, so 실행 취소 can bring it back', () => {
  act(openSong);
  const view = panels();
  // NOTE(0913vision): A song deleted while it is open closes its draft alone,
  // as here.
  act(closeSongDraft);
  view.rerender();
  expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
  expect(
    workspaceTabOf('prep', usePrepTarget.getState().target?.kind === 'song'),
  ).toBe('library');
  expect(view.result.current.columns.flat()).toEqual([
    '라이브러리',
    '편집',
    '슬라이드 속성',
  ]);
  expect(view.result.current.editing).toBe(false);
});

it('keeps 라이브러리 while its song is open', () => {
  act(openSong);
  const view = panels();
  view.rerender();
  expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
  expect(view.result.current.editing).toBe(true);
});
