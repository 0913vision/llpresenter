import type {SongSession} from './songSession';
import {useShow} from '@renderer/session/show';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import type {LlpApi} from '@contracts/ipc/api';

/** An item override wins over its library song background. */
export function resolveSongSlideBackground(
  item: string | undefined,
  library: string | undefined,
): string | undefined {
  return item ?? library;
}

/** The same local theme and effective background for every editor picture. */
export function useSongSlideAppearance(
  session: SongSession,
  options: {
    readonly role?: 'audience' | 'stage' | 'broadcast';
    readonly screenId?: string;
    readonly api?: Pick<LlpApi, 'settings'> & Partial<Pick<LlpApi, 'log'>>;
  } = {},
) {
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
    options,
  );
  return theme === undefined
    ? undefined
    : {
        ...theme,
        background:
          itemRow?.backgroundNone === true
            ? undefined
            : resolveSongSlideBackground(
                session.itemSession ? theme.background : session.background,
                session.itemSession ? session.background : theme.background,
              ),
      };
}
