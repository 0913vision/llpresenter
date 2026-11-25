import {useEffect, useRef} from 'react';
import type {SongId} from '@core/schema/common/ids';
import {
  requestLeaveSong,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {
  closePrepEditor,
  openInPrep,
  usePrepTarget,
} from '@renderer/session/prepTarget';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';

/**
 * The tabs of the toolbar: the workspaces, and 라이브러리 where the library
 * songs are edited (USER Nov 25). 라이브러리 is 준비 with a song open, so a
 * song keeps its own place and its own 실행 취소.
 */
export type WorkspaceTab = Workspace | 'library';

/** The tab a workspace shows as. */
export function workspaceTabOf(
  workspace: Workspace,
  songOpen: boolean,
): WorkspaceTab {
  return workspace === 'prep' && songOpen ? 'library' : workspace;
}

/** What the tabs act with. */
export interface WorkspaceTabActions {
  /** The workspace the window shows. */
  readonly workspace: Workspace;
  readonly switchTo: (workspace: Workspace) => void;
  readonly openSong: (songId: SongId) => void;
  readonly newSong: () => void;
}

/**
 * The toolbar tab that is on, and a switch to another. 라이브러리 opens the
 * song open before, else the song edited last, else the first library song,
 * else a new song. 준비 leaves the song as closing it does.
 */
export function useWorkspaceTabs({
  workspace,
  switchTo,
  openSong,
  newSong,
}: WorkspaceTabActions): {
  readonly tab: WorkspaceTab;
  readonly onTab: (tab: WorkspaceTab) => void;
} {
  const songOpen = usePrepTarget(view => view.target?.kind === 'song');
  const songId = useSongDraft(view => view.draft?.song.id ?? null);
  const lastSong = useRef<string | null>(null);
  useEffect(() => {
    if (songId !== null) lastSong.current = songId;
  }, [songId]);
  const tab = workspaceTabOf(workspace, songOpen);
  const openLibrary = (): void => {
    const {draft, library} = useSongDraft.getState();
    if (draft !== null) {
      openInPrep({kind: 'song'});
      return;
    }
    const last = library.find(song => song.id === lastSong.current);
    const song = last ?? library[0];
    if (song === undefined) newSong();
    else openSong(song.id);
  };
  const onTab = (next: WorkspaceTab): void => {
    if (next === tab) return;
    if (next === 'library') openLibrary();
    else if (next === 'prep' && tab === 'library') {
      requestLeaveSong(closePrepEditor);
    } else switchTo(next);
  };
  return {tab, onTab};
}
