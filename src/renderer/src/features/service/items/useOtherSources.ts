import {useEffect, useState} from 'react';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaDocument} from '@core/schema/mediaEdit';

export function useOtherSources(open: boolean) {
  const api = window.llp;
  const [sources, setSources] = useState<{
    readonly media: readonly MediaItem[];
    readonly mediaRevision: number;
  }>({media: [], mediaRevision: -1});
  useEffect(() => {
    if (!open || api === undefined) return undefined;
    let current = true;
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
    api.media
      .get()
      .then(acceptMedia, (error: unknown) =>
        console.error('Media list read failed', error),
      );
    return () => {
      current = false;
      stopMedia();
    };
  }, [api, open]);
  return sources;
}
