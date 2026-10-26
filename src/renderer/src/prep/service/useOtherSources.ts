import {useEffect, useState} from 'react';
import type {MediaItem} from '@shared/schema/mediaList';
import type {NoticesFile} from '@shared/schema/notices';

// NOTE(0913vision): The media list and 공지 sets are read once each time the
// popover or the panel opens.
export function useOtherSources(open: boolean) {
  const [sources, setSources] = useState<{
    readonly media: readonly MediaItem[];
    readonly notices: NoticesFile['sets'];
  }>({media: [], notices: []});
  useEffect(() => {
    const api = window.llp;
    if (!open || api === undefined) return undefined;
    let current = true;
    api.media.get().then(
      document => {
        if (current) {
          setSources(state => ({...state, media: document.value.items}));
        }
      },
      (error: unknown) => console.error('Media list read failed', error),
    );
    api.settings.get({name: 'notices'}).then(
      document => {
        if (current && document.name === 'notices') {
          setSources(state => ({...state, notices: document.value.sets}));
        }
      },
      (error: unknown) => console.error('공지 sets read failed', error),
    );
    return () => {
      current = false;
    };
  }, [open]);
  return sources;
}
