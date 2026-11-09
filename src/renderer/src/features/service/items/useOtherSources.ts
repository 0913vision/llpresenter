import {useEffect, useRef, useState} from 'react';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {MediaId} from '@core/schema/ids';
import type {MissingMedia} from '@core/schema/mediaFiles';

export function useOtherSources(open: boolean) {
  const api = window.llp;
  const latestMissing = useRef<ReadonlySet<MediaId> | null>(null);
  const [missingMedia, setMissingMedia] = useState<ReadonlySet<MediaId> | null>(
    null,
  );
  const [sources, setSources] = useState<{
    readonly media: readonly MediaItem[];
    readonly mediaRevision: number;
  }>({media: [], mediaRevision: -1});
  useEffect(() => {
    if (!open || api === undefined) return undefined;
    let current = true;
    let missingPushed = false;
    const acceptMissing = (missing: MissingMedia): void => {
      if (!current) return;
      const next = new Set(missing);
      latestMissing.current = next;
      setMissingMedia(next);
    };
    const acceptMedia = (document: MediaDocument): void => {
      if (!current) return;
      setSources(state =>
        document.revision <= state.mediaRevision
          ? state
          : {
              ...state,
              media: document.value.items,
              mediaRevision: document.revision,
            },
      );
    };
    const stopMedia = api.media.subscribe(acceptMedia);
    const stopMissing = api.media.subscribeMissing(missing => {
      missingPushed = true;
      acceptMissing(missing);
    });
    api.media.missing().then(
      missing => {
        if (!missingPushed) acceptMissing(missing);
      },
      (error: unknown) => console.error('Missing media read failed', error),
    );
    api.media
      .get()
      .then(acceptMedia, (error: unknown) =>
        console.error('Media list read failed', error),
      );
    return () => {
      current = false;
      stopMedia();
      stopMissing();
      latestMissing.current = null;
      setMissingMedia(null);
    };
  }, [api, open]);
  return {
    ...sources,
    missingMedia: missingMedia ?? new Set<MediaId>(),
    mediaReady: missingMedia !== null,
    canAddMedia: (id: MediaId): boolean =>
      latestMissing.current !== null && !latestMissing.current.has(id),
  };
}
