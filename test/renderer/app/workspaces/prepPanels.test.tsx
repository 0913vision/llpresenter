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

it('leaves 라이브러리 for 준비 when the open song is deleted, instead of showing the 예배 순서 under it', () => {
  act(openSong);
  const view = panels();
  expect(
    workspaceTabOf('prep', usePrepTarget.getState().target?.kind === 'song'),
  ).toBe('library');
  // NOTE(0913vision): A song deleted while it is open closes its draft alone,
  // as here.
  act(closeSongDraft);
  view.rerender();
  expect(usePrepTarget.getState().target).toBeNull();
  expect(workspaceTabOf('prep', false)).toBe('prep');
});

it('keeps 라이브러리 while its song is open', () => {
  act(openSong);
  const view = panels();
  view.rerender();
  expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
  expect(view.result.current.editing).toBe(true);
});
