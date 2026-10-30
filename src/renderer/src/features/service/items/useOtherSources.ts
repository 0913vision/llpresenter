import {useEffect, useState} from 'react';
import type {MediaItem} from '@core/schema/mediaList';
import type {NoticesFile} from '@core/schema/notices';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {SettingsDocument} from '@core/schema/settingsDocuments';

export function useOtherSources(open: boolean) {
  const api = window.llp;
  const [sources, setSources] = useState<{
    readonly media: readonly MediaItem[];
    readonly notices: NoticesFile['sets'];
    readonly mediaRevision: number;
    readonly noticesRevision: number;
  }>({media: [], notices: [], mediaRevision: -1, noticesRevision: -1});
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
    const acceptNotices = (document: SettingsDocument): void => {
      if (!current || document.name !== 'notices') return;
      setSources(state =>
        document.revision <= state.noticesRevision
          ? state
          : {
              ...state,
              notices: document.value.sets,
              noticesRevision: document.revision,
            },
      );
    };
    const stopMedia = api.media.subscribe(acceptMedia);
    const stopNotices = api.settings.subscribe(acceptNotices);
    api.media
      .get()
      .then(acceptMedia, (error: unknown) =>
        console.error('Media list read failed', error),
      );
    api.settings
      .get({name: 'notices'})
      .then(acceptNotices, (error: unknown) =>
        console.error('공지 sets read failed', error),
      );
    return () => {
      current = false;
      stopMedia();
      stopNotices();
    };
  }, [api, open]);
  return sources;
}
