import {create} from 'zustand';
import type {LlpApi} from '@contracts/ipc/api';
import type {MediaId} from '@core/schema/common/ids';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import type {MediaItem} from '@core/schema/media/mediaList';

/** The media list, as every part of this window offers it. */
export interface MediaView {
  readonly document: MediaDocument | null;
  readonly items: readonly MediaItem[];
  /** The files that are gone; none is known until the first answer. */
  readonly missing: ReadonlySet<MediaId> | null;
  readonly failed: boolean;
}

export const useMedia = create<MediaView>(() => ({
  document: null,
  items: [],
  missing: null,
  failed: false,
}));

/** The pictures and videos a slide can have behind its texts. */
export function pictureMedia(
  items: readonly MediaItem[],
): readonly MediaItem[] {
  return items.filter(item => item.kind !== 'audio' && item.internal !== true);
}

/** Whether a file is there to be added. */
export function canAddMedia(id: MediaId): boolean {
  const {missing} = useMedia.getState();
  return missing !== null && !missing.has(id);
}

export function mediaItem(id: MediaId): MediaItem | undefined {
  return useMedia.getState().items.find(item => item.id === id);
}

type Feeds = Pick<LlpApi, 'media' | 'log'>;

/**
 * Follows the media list.
 *
 * @returns A function that stops following. Always call it.
 */
export function startMediaSync(api: Feeds | undefined): () => void {
  if (api === undefined) return () => undefined;
  let stopped = false;
  let missingPushed = false;
  const accept = (document: MediaDocument): void => {
    const known = useMedia.getState().document;
    if (stopped || (known !== null && known.revision > document.revision)) {
      return;
    }
    useMedia.setState({document, items: document.value.items});
  };
  const acceptMissing = (missing: readonly MediaId[]): void => {
    if (!stopped) useMedia.setState({missing: new Set(missing), failed: false});
  };
  const problem = (message: string) => (error: unknown) => {
    if (stopped) return;
    useMedia.setState({failed: true});
    api.log.write({
      level: 'error',
      message,
      detail: error instanceof Error ? error.message : String(error),
    });
  };
  const stops = [
    api.media.subscribe(accept),
    api.media.subscribeMissing(missing => {
      missingPushed = true;
      acceptMissing([...missing]);
    }),
  ];
  api.media.get().then(accept, problem('Could not read the media list'));
  api.media.missing().then(missing => {
    if (!missingPushed) acceptMissing([...missing]);
  }, problem('Could not read the missing media'));
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}
