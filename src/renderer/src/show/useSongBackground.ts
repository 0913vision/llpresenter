import {useEffect, useRef, useState} from 'react';
import type {SongDocument} from '@core/schema/contentDocuments';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {MediaId, SongId} from '@core/schema/ids';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {applyService, useShow} from '@renderer/state/show';
import {sendLive, useLive} from '@renderer/platform/live';
import {updateServiceBackground} from '@renderer/features/service/state/serviceBackground';
import {noticeTime, type Notice} from '@renderer/ui/notices';

interface BackgroundView {
  readonly serviceId: string;
  readonly item: ServiceItemOf<'song'>;
  readonly song: SongDocument | null;
  readonly media: MediaDocument;
  readonly readOnly: boolean;
}

function notice(cause: 'load' | 'change' | 'save'): Notice {
  const titles = {
    load: '배경 정보 불러오기 실패',
    change: '배경 변경 실패',
    save: '예배 순서 저장 실패',
  };
  return {
    key: `song-background:${cause}`,
    kind: 'warning',
    icon: 'warning',
    title: titles[cause],
    time: noticeTime(),
  };
}

/** Reads the selected song's background and changes only its service override. */
export function useSongBackground(onProblem: (notice: Notice) => void) {
  const serviceId = useShow(view => view.serviceId);
  const itemId = useShow(view => view.openItemId);
  const isSong = useShow(view =>
    view.rows.some(row => row.id === itemId && row.kind === 'song'),
  );
  const [view, setView] = useState<BackgroundView | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const reload = useRef((): void => undefined);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const api = window.llp;
    if (!isSong || serviceId === null || itemId === null || api === undefined) {
      return undefined;
    }
    let active = true;
    let version = 0;
    let songId: SongId | undefined;
    const isCurrent = (request: number): boolean =>
      active && request === version;
    const load = async (): Promise<void> => {
      const request = ++version;
      try {
        const [document, media] = await Promise.all([
          api.services.get(serviceId),
          api.media.get(),
        ]);
        if (!isCurrent(request)) return;
        if (document?.service.id !== serviceId) {
          setView(null);
          return;
        }
        const item = document.service.order.find(row => row.id === itemId);
        if (item === undefined || !isItemOfKind(item, 'song')) {
          setView(null);
          return;
        }
        songId = item.song;
        const song = await api.songs.get(songId);
        if (isCurrent(request)) {
          setView({
            serviceId,
            item,
            song,
            media,
            readOnly: document.access === 'readOnly',
          });
        }
      } catch (cause) {
        api.log.write({
          level: 'error',
          message: 'Could not read the song background',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (isCurrent(request)) onProblem(notice('load'));
      }
    };
    const refresh = (): void => {
      load().catch((cause: unknown) =>
        console.error('Failed to report a background read:', cause),
      );
    };
    reload.current = refresh;
    const stops = [
      api.services.subscribe(change => {
        if (change.serviceId === serviceId) refresh();
      }),
      api.songs.subscribe(change => {
        if (songId === undefined || change.songId === songId) refresh();
      }),
      api.media.subscribe(refresh),
    ];
    refresh();
    return () => {
      active = false;
      version++;
      reload.current = () => undefined;
      for (const stop of stops) stop();
    };
  }, [serviceId, itemId, isSong, onProblem]);

  const change = async (mediaId: MediaId | null): Promise<void> => {
    const api = window.llp;
    if (
      pending.current ||
      api === undefined ||
      serviceId === null ||
      itemId === null ||
      !isSong
    ) {
      return;
    }
    pending.current = true;
    setBusy(true);
    const commandVersion = useLive.getState().commandVersion;
    const previousMedia = useLive.getState().state?.layers.media;
    try {
      const result = await updateServiceBackground(api, {
        serviceId,
        itemId,
        mediaId,
      });
      if (!result.ok && result.error.reason !== 'write-failed') {
        api.log.write({
          level: 'error',
          message: 'Could not change the song background',
          detail: result.error.message,
        });
        if (alive.current) onProblem(notice('change'));
        return;
      }
      if (!result.ok && alive.current) onProblem(notice('save'));
      reload.current();
      const projection = await api.service.get();
      const shown = useShow.getState();
      if (
        projection?.id !== serviceId ||
        shown.serviceId !== serviceId ||
        projection.revision < (shown.revision ?? 0)
      ) {
        return;
      }
      applyService(projection);
      const live = useLive.getState();
      const row = projection.rows.find(row => row.id === itemId);
      if (
        !alive.current ||
        live.commandVersion !== commandVersion ||
        live.state?.layers.slide?.itemId !== itemId ||
        row?.kind !== 'song' ||
        row.background === undefined ||
        (mediaId !== null && row.background.mediaId !== mediaId)
      ) {
        return;
      }
      const playing = live.state.layers.media;
      if (
        playing?.mediaId !== previousMedia?.mediaId ||
        playing?.loop !== previousMedia?.loop ||
        playing?.startedAt !== previousMedia?.startedAt
      ) {
        return;
      }
      if (
        playing?.mediaId !== row.background.mediaId ||
        playing.loop !== row.background.loop
      ) {
        sendLive({type: 'media.show', media: row.background});
      }
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not refresh the changed song background',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (alive.current) onProblem(notice('load'));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const choose = (mediaId: MediaId | null): void => {
    change(mediaId).catch((cause: unknown) =>
      console.error('Failed to report a background change:', cause),
    );
  };
  return {
    view:
      isSong && view?.serviceId === serviceId && view.item.id === itemId
        ? view
        : null,
    busy,
    choose,
  };
}
