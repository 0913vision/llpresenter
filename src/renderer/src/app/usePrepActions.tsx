import {useCallback, useState, type JSX} from 'react';
import type {SongId} from '@core/schema/ids';
import {PowerPointImportFlow} from '@renderer/features/songs/import/PowerPointImportFlow';
import {TextImportFlow} from '@renderer/features/songs/import/TextImportFlow';
import {SongDraftDialogs} from '@renderer/features/songs/SongDraftDialogs';
import {
  openNewSong,
  openSongDraft,
  requestLeaveSong,
  useSongDraft,
} from '@renderer/features/songs/songDraft';
import {openDeckAt} from '@renderer/features/slides/deckSelection';
import {openInPrep, usePrepTarget} from '@renderer/session/prepTarget';
import {useShow} from '@renderer/session/show';
import {isLibrarySource} from '@renderer/session/showLibrary';
import {noticeTime} from '@renderer/ui/notices';
import type {ControlSession} from './controlSession';
import {PowerPointImagesFlow} from './PowerPointImagesFlow';
import {editItemInPrep, type PrepBinding} from './workspaces/prepPanels';

export type ImportSource =
  'file' | 'clipboard' | 'powerpoint' | 'powerpoint-images';

/** What the window can open in 준비, and the surfaces that belong to it. */
export interface PrepActions {
  readonly prep: PrepBinding | undefined;
  /** A song waits to be saved for the first time. */
  readonly imported: boolean;
  readonly editingSong: boolean;
  readonly canImport: boolean;
  readonly importSong: (source: ImportSource) => void;
  /** 새 곡: opens 준비 and makes a song, as the library's plus does. */
  readonly newSong: () => void;
  readonly openSong: (songId: SongId, position?: number) => void;
  readonly onOpenPrep: (itemId: string, position?: number) => void;
  readonly surface: JSX.Element | null;
}

/** Opens songs and items in 준비, keeping an unsaved song until it is decided. */
export function usePrepActions(session: ControlSession): PrepActions {
  const {api, report} = session;
  const [source, setSource] = useState<ImportSource | null>(null);
  const done = useCallback(() => setSource(null), []);
  const draft = useSongDraft(view => view.draft);
  const songOpen = usePrepTarget(view => view.target?.kind === 'song');
  const failed = (): void =>
    report({
      key: 'prep:song-open',
      kind: 'warning',
      icon: 'warning',
      title: '곡 열기 실패',
      time: noticeTime(),
    });
  const openSong = (songId: SongId, position = 0): void =>
    requestLeaveSong(() => {
      api?.songs.get(songId).then(document => {
        if (document === null) {
          failed();
          return;
        }
        openSongDraft(document);
        openDeckAt(document.song.id, document.song.slides[position]?.id);
        openInPrep({kind: 'song'});
      }, failed);
    });
  const newSong = (): void =>
    requestLeaveSong(() => {
      openNewSong();
      openInPrep({kind: 'song'});
    });
  const onOpenPrep = (itemId: string, position?: number): void => {
    const view = useShow.getState();
    if (isLibrarySource(view, itemId)) {
      openSong(view.librarySong.songId, position);
    } else editItemInPrep(itemId, position);
  };
  const imported = songOpen && draft !== null && draft.document === null;
  return {
    prep: api === undefined ? undefined : {api, onNewSong: newSong, openSong},
    imported,
    editingSong: songOpen && draft !== null,
    canImport: api !== undefined && source === null,
    importSong: next => {
      if (api !== undefined && source === null) setSource(next);
    },
    newSong,
    openSong,
    onOpenPrep,
    surface:
      api === undefined ? null : (
        <>
          <SongDraftDialogs />
          {source === 'powerpoint-images' ? (
            <PowerPointImagesFlow api={api} onDone={done} onProblem={report} />
          ) : source === 'powerpoint' ? (
            <PowerPointImportFlow api={api} onDone={done} onProblem={report} />
          ) : source === null ? null : (
            <TextImportFlow
              api={api}
              source={source}
              onDone={done}
              onProblem={report}
            />
          )}
        </>
      ),
  };
}
