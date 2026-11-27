import {useEffect, useRef} from 'react';
import type {SongId} from '@core/schema/common/ids';
import {useSongDraft} from '@renderer/features/songs/draft';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';

/** The tabs of the toolbar, one per workspace. */
export type WorkspaceTab = Workspace;

/** What the tabs act with. */
export interface WorkspaceTabActions {
  /** The workspace the window shows. */
  readonly workspace: Workspace;
  readonly switchTo: (workspace: Workspace) => void;
  readonly openSong: (songId: SongId) => void;
  readonly newSong: () => void;
}

/**
 * The toolbar tab that is on, and a switch to another. 라이브러리 shows the
 * song left open there; with none, it opens the song edited last, else the
 * first library song, else a new song.
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
  const songId = useSongDraft(view => view.draft?.song.id ?? null);
  const lastSong = useRef<string | null>(null);
  useEffect(() => {
    if (songId !== null) lastSong.current = songId;
  }, [songId]);
  const openLibrary = (): void => {
    const {draft, library} = useSongDraft.getState();
    if (draft !== null) {
      switchTo('library');
      return;
    }
    const last = library.find(song => song.id === lastSong.current);
    const song = last ?? library[0];
    if (song === undefined) newSong();
    else openSong(song.id);
  };
  const onTab = (next: WorkspaceTab): void => {
    if (next === workspace) return;
    if (next === 'library') openLibrary();
    else switchTo(next);
  };
  return {tab: workspace, onTab};
}
