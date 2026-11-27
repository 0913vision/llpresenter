import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {useWorkspaceTabs} from '@renderer/app/useWorkspaceTabs';
import {
  closeSongDraft,
  openSongDraft,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {closePrepEditor} from '@renderer/session/prepTarget';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';
import {lyricsSlide} from '@fixtures/core/slides';

function librarySong(id: string, title: string): LibrarySong {
  return {
    id: createSongId(id),
    title,
    slideCount: 1,
    access: 'editable',
    usedBy: [],
  };
}

const first = librarySong('00000000-0000-4000-8000-000000000101', '첫 곡');
const second = librarySong('00000000-0000-4000-8000-000000000102', '둘째 곡');

function setup(workspace: Workspace) {
  const actions = {
    switchTo: vi.fn(),
    openSong: vi.fn(),
    newSong: vi.fn(),
  };
  const hook = renderHook(() => useWorkspaceTabs({workspace, ...actions}));
  return {...actions, hook};
}

afterEach(() => {
  closeSongDraft();
  closePrepEditor();
  useSongDraft.setState({library: []});
});

describe('the 라이브러리 tab', () => {
  it('opens the song left open, else the first library song, else a new song', () => {
    const {hook, openSong, newSong, switchTo} = setup('show');
    act(() => hook.result.current.onTab('library'));
    expect(newSong).toHaveBeenCalledOnce();

    useSongDraft.setState({library: [first, second]});
    act(() => hook.result.current.onTab('library'));
    expect(openSong).toHaveBeenLastCalledWith(first.id);

    act(() =>
      openSongDraft({
        song: {
          format: 'llsong',
          schemaVersion: SONG_SCHEMA_VERSION,
          id: second.id,
          title: second.title,
          slides: [lyricsSlide(1, '가사')],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    act(() => hook.result.current.onTab('library'));
    expect(switchTo).toHaveBeenCalledWith('library');
    expect(openSong).toHaveBeenCalledOnce();
  });

  it('opens the song edited last once it was closed', () => {
    useSongDraft.setState({library: [first, second]});
    const {hook, openSong} = setup('prep');
    act(() =>
      openSongDraft({
        song: {
          format: 'llsong',
          schemaVersion: SONG_SCHEMA_VERSION,
          id: second.id,
          title: second.title,
          slides: [lyricsSlide(1, '가사')],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    hook.rerender();
    act(() => closeSongDraft());
    hook.rerender();

    act(() => hook.result.current.onTab('library'));

    expect(openSong).toHaveBeenCalledWith(second.id);
  });

  it('is the workspace on screen, and every other tab goes to the workspace switch without closing the open song', () => {
    const {hook, switchTo} = setup('library');
    expect(hook.result.current.tab).toBe('library');
    act(() => hook.result.current.onTab('show'));
    expect(switchTo).toHaveBeenCalledWith('show');
    act(() => hook.result.current.onTab('prep'));
    expect(switchTo).toHaveBeenLastCalledWith('prep');
  });

  it('shows the song left open when 라이브러리 is pressed again, without reading it again', () => {
    useSongDraft.setState({library: [first, second]});
    const {hook, switchTo, openSong} = setup('show');
    act(() =>
      openSongDraft({
        song: {
          format: 'llsong',
          schemaVersion: SONG_SCHEMA_VERSION,
          id: second.id,
          title: second.title,
          slides: [lyricsSlide(1, '가사')],
        },
        revision: 1,
        access: 'editable',
      }),
    );
    act(() => hook.result.current.onTab('library'));
    expect(switchTo).toHaveBeenCalledWith('library');
    expect(openSong).not.toHaveBeenCalled();
  });
});
