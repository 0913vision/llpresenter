import {useEffect, useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {OrderEditorTarget} from '@core/schema/ipcPayloads';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import type {Label} from '@core/schema/labels';
import {useFollowedDocument} from '@renderer/features/service/items/useFollowedDocument';
import {useItemSettings} from '@renderer/features/service/items/useItemSources';

/**
 * The song item the window shows: the one it was opened on, then every
 * retarget push. A push that comes before the first answer wins.
 */
export function useOrderEditorTarget(
  api: Pick<LlpApi, 'orderEditor'>,
): OrderEditorTarget | null {
  const [target, setTarget] = useState<OrderEditorTarget | null>(null);
  useEffect(() => {
    let alive = true;
    let pushed = false;
    const stop = api.orderEditor.onRetarget(next => {
      pushed = true;
      setTarget(next);
    });
    api.orderEditor.target().then(
      first => {
        if (alive && !pushed) setTarget(first);
      },
      (error: unknown) =>
        console.error('Could not read the order editor target', error),
    );
    return () => {
      alive = false;
      stop();
    };
  }, [api]);
  return target;
}

/**
 * Follows one 예배 순서 file. Mount it with a key of the service, because a
 * followed document never goes back to an older revision.
 */
export function useFollowedService(
  api: Pick<LlpApi, 'services'>,
  serviceId: string,
): ServiceDocument | null {
  const source = useMemo(
    () => ({
      read: async () => {
        const document = await api.services.get(serviceId);
        if (document === null) throw new Error('The service is gone');
        return document;
      },
      follow: (accept: (document: ServiceDocument) => void) =>
        api.services.subscribe(change => {
          if (change.serviceId === serviceId && change.document !== null) {
            accept(change.document);
          }
        }),
    }),
    [api, serviceId],
  );
  return useFollowedDocument(source).document;
}

/** Follows one library song. Mount it with a key of the song. */
export function useFollowedSong(
  api: Pick<LlpApi, 'songs'>,
  songId: string,
): {readonly document: SongDocument | null; readonly reload: () => void} {
  const source = useMemo(
    () => ({
      read: async () => {
        const document = await api.songs.get(songId);
        if (document === null) throw new Error('The song is gone');
        return document;
      },
      follow: (accept: (document: SongDocument) => void) =>
        api.songs.subscribe(change => {
          if (change.songId === songId && change.document !== null) {
            accept(change.document);
          }
        }),
    }),
    [api, songId],
  );
  const {document, retry} = useFollowedDocument(source);
  return {document, reload: retry};
}

const NO_LABELS: readonly Label[] = [];

/** The 이름표 of the app, which color the chips and the slide bands. */
export function useOrderEditorLabels(
  api: Pick<LlpApi, 'settings'>,
): readonly Label[] {
  const {document} = useItemSettings(api.settings, 'labels');
  return document?.name === 'labels' ? document.value.labels : NO_LABELS;
}
