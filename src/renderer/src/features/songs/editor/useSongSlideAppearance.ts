import type {SongSession} from './songSession';
import {useShow} from '@renderer/session/show';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {songItemBackground} from '@core/songs/songBackground';

/** The same local theme and effective background for every editor picture. */
export function useSongSlideAppearance(session: SongSession) {
  const song = session.history.snapshot.song;
  const row = useShow(view => view.rows.find(entry => entry.id === song.id));
  const itemRow = row?.kind === 'song' ? row : undefined;
  const theme = useSlideTheme(
    session.itemSession && itemRow !== undefined
      ? itemRow
      : {
          id: song.id,
          kind: 'song',
          title: song.title,
          ...(song.theme === undefined ? {} : {theme: song.theme}),
        },
    session.itemSession || song.theme !== undefined ? 'service' : 'external',
  );
  return theme === undefined
    ? undefined
    : {
        ...theme,
        songBackground: songItemBackground({
          backgroundNone: itemRow?.backgroundNone,
          item: session.itemSession ? itemRow?.background?.mediaId : undefined,
          song: session.background,
        }),
        background: songItemBackground({
          backgroundNone: itemRow?.backgroundNone,
          item: session.itemSession ? theme.background : session.background,
          song: session.itemSession ? session.background : theme.background,
        }),
      };
}
