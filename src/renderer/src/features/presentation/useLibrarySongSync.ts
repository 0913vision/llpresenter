import {useEffect, useEffectEvent} from 'react';
import {useShow} from '@renderer/features/presentation/state/show';
import {refreshLibrarySong} from '@renderer/features/presentation/state/showLibrary';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** Refreshes the single retained library projection and releases all feeds. */
export function useLibrarySongSync(onProblem: (notice: Notice) => void): void {
  const songId = useShow(view => view.librarySong?.songId);
  const report = useEffectEvent(onProblem);
  useEffect(() => {
    const api = window.llp;
    if (!api || !songId) return undefined;
    let active = true;
    let version = 0;
    const refresh = async (): Promise<void> => {
      const request = ++version;
      try {
        const song = await api.library.showSong({songId});
        if (active && request === version) refreshLibrarySong(songId, song);
      } catch (cause) {
        api.log.write({
          level: 'error',
          message: 'Could not refresh the open library song',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (active && request === version) {
          report({
            key: 'library-song:refresh',
            kind: 'warning',
            icon: 'warning',
            title: '곡 불러오기 실패',
            time: noticeTime(),
          });
        }
      }
    };
    const reload = (): void => {
      if (!active) return;
      refresh().catch((cause: unknown) =>
        console.error('Library song refresh callback failed:', cause),
      );
    };
    const stops = [
      api.songs.subscribe(change => {
        if (change.songId === songId) reload();
      }),
      api.settings.subscribe(document => {
        if (document.name === 'labels') reload();
      }),
      api.media.subscribe(reload),
    ];
    reload();
    return () => {
      active = false;
      version++;
      for (const stop of stops) stop();
    };
  }, [songId]);
}
