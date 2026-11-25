import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import {SONG_SCHEMA_VERSION} from '@core/schema/songs/song';
import {useWorkspaceTabs, workspaceTabOf} from '@renderer/app/useWorkspaceTabs';
import {
  closeSongDraft,
  openSongDraft,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {
  closePrepEditor,
  openInPrep,
  usePrepTarget,
} from '@renderer/session/prepTarget';
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

describe('workspaceTabOf', () => {
  it('shows 준비 with a song open as 라이브러리, and the other workspaces as they are', () => {
    expect(workspaceTabOf('prep', true)).toBe('library');
    expect(workspaceTabOf('prep', false)).toBe('prep');
    expect(workspaceTabOf('show', true)).toBe('show');
    expect(workspaceTabOf('screens', false)).toBe('screens');
  });
});

describe('the 라이브러리 tab', () => {
  it('opens the song left open, else the first library song, else a new song', () => {
    const {hook, openSong, newSong} = setup('show');
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
    expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
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

  it('is the tab while 준비 edits a song, and 준비 then leaves the song for the 예배 순서', () => {
    const {hook, switchTo} = setup('prep');
    act(() => openInPrep({kind: 'song'}));
    expect(hook.result.current.tab).toBe('library');

    act(() => hook.result.current.onTab('prep'));

    expect(usePrepTarget.getState().target).toBeNull();
    expect(switchTo).not.toHaveBeenCalled();
  });

  it('leaves the other tabs to the workspace switch', () => {
    const {hook, switchTo} = setup('prep');
    act(() => openInPrep({kind: 'song'}));

    act(() => hook.result.current.onTab('show'));

    expect(switchTo).toHaveBeenCalledWith('show');
  });
});
