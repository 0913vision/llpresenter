import {placedOverlays} from '@core/live';
import type {LiveItem} from '@core/schema/live/liveTheme';
import {LIVE_STATE_LIMITS} from '@core/schema/live/liveLimits';
import {hasSlides} from '@core/schema/services/service';
import {songIdSchema} from '@core/schema/common/ids';
import {parsePayload} from '@core/schema/common/payload';
import {itemTitle} from '@core/slides';
import type {DataStore} from '../../store/register';
import type {Logger} from '../../base/log';
import {ThemeRuntime} from './themeRuntime';
import {dispatchLogged, type LiveStore} from '../store';

const LIBRARY_ITEM = 'library:';

/** Connects current service items and theme settings, releasing both on shutdown. */
export function registerThemeOutput({
  store,
  data,
  log,
}: {
  readonly store: LiveStore;
  readonly data: Pick<DataStore, 'content' | 'settings' | 'media'>;
  readonly log: Logger;
}): () => void {
  let stopped = false;
  let release: (() => void) | undefined;
  let unsubscribe: (() => void) | undefined;
  let unsubscribeMedia: (() => void) | undefined;
  Promise.all([data.content, data.settings, data.media])
    .then(([content, settings, media]) => {
      if (stopped || settings === null || content === null) return;
      const short = (text: string): string =>
        text.slice(0, LIVE_STATE_LIMITS.textCharacters);
      const runtime = new ThemeRuntime({
        settings,
        item: (id): LiveItem | undefined => {
          if (id.startsWith(LIBRARY_ITEM)) {
            const songId = parsePayload(
              songIdSchema,
              id.slice(LIBRARY_ITEM.length),
            );
            const song = songId.ok
              ? content.song(songId.value)?.song
              : undefined;
            return song === undefined
              ? undefined
              : {
                  id,
                  kind: 'song',
                  source: 'external',
                  title: short(song.title),
                };
          }
          const serviceId = content.openServiceId;
          const item =
            serviceId === null
              ? undefined
              : content
                  .service(serviceId)
                  ?.service.order.find(entry => entry.id === id);
          if (item === undefined || !hasSlides(item)) return undefined;
          return {
            id,
            kind: item.kind,
            source: 'service',
            title: short(itemTitle(item)),
            ...(item.overlays === undefined
              ? {}
              : {overlays: placedOverlays(item.overlays, item.slides)}),
          };
        },
        onError: error =>
          log.warn('could not read theme output settings', error),
        onMissingTheme: id => log.warn('missing theme; using fallback', {id}),
      });
      release = store.connectThemes(runtime);
      unsubscribe = settings.subscribe(document => {
        if (
          !stopped &&
          (document.name === 'themes' || document.name === 'screens')
        ) {
          dispatchLogged(store, {type: 'themes.refresh'}, log);
        }
      });
      unsubscribeMedia = media?.subscribe(() => {
        if (!stopped) dispatchLogged(store, {type: 'themes.refresh'}, log);
      });
      dispatchLogged(store, {type: 'themes.refresh'}, log);
    })
    .catch((error: unknown) =>
      log.error('could not connect theme output', error),
    );
  return () => {
    stopped = true;
    unsubscribe?.();
    unsubscribeMedia?.();
    release?.();
  };
}
