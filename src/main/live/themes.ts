import {displayReference} from '@core/bible/displayReference';
import {cardOffset} from '@core/services/sectionCards';
import {projectedItemOverlays} from '@core/services/songItemOverlays';
import {isItemOfKind} from '@core/schema/service';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {songIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {itemThemeKind} from '@core/themes/itemKind';
import {isStartItem} from '@core/services/itemFieldChanges';
import type {DataStore} from '../store/register';
import type {Logger} from '../log';
import {ThemeRuntime} from './themeRuntime';
import {mediaLoops} from '@core/media/mediaEndRule';
import {outputMediaProperties} from '@core/schema/outputMedia';
import {broadcastSongTitle} from '@core/songs/broadcastSongTitle';
import {dispatchLogged, type LiveStore} from './store';

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
      const runtime = new ThemeRuntime({
        settings,
        item: id => {
          if (id.startsWith('library:')) {
            const songId = parsePayload(
              songIdSchema,
              id.slice('library:'.length),
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
                  title: song.title.slice(0, LIVE_STATE_LIMITS.textCharacters),
                  ...(broadcastSongTitle(song) === song.title
                    ? {}
                    : {
                        broadcastSongTitle: broadcastSongTitle(song).slice(
                          0,
                          LIVE_STATE_LIMITS.textCharacters,
                        ),
                      }),
                };
          }
          const serviceId = content.openServiceId;
          const entry =
            serviceId === null
              ? undefined
              : content
                  .service(serviceId)
                  ?.service.order.find(item => item.id === id);
          if (entry === undefined) return undefined;
          const kind = itemThemeKind(entry);
          if (kind === undefined) return undefined;
          const song = isItemOfKind(entry, 'song')
            ? content.song(entry.song)?.song
            : undefined;
          const theme = entry.theme ?? song?.theme;
          const title = isItemOfKind(entry, 'slides')
            ? entry.slides.name
            : isItemOfKind(entry, 'song')
              ? content.song(entry.song)?.song.title
              : isItemOfKind(entry, 'media')
                ? media?.get().value.items.find(item => item.id === entry.media)
                    ?.name
                : isItemOfKind(entry, 'bible')
                  ? displayReference(entry.bible.ref)
                  : isItemOfKind(entry, 'sermon')
                    ? displayReference(entry.sermon.passage.ref)
                    : undefined;
          const backgroundId = isStartItem(entry)
            ? entry.background
            : undefined;
          const background =
            backgroundId === undefined
              ? undefined
              : media?.get().value.items.find(item => item.id === backgroundId);
          const backgroundOverride =
            isStartItem(entry) && entry.backgroundNone
              ? {kind: 'none' as const}
              : backgroundId === undefined
                ? undefined
                : {
                    kind: 'media' as const,
                    mediaId: backgroundId,
                    loop:
                      background === undefined ? false : mediaLoops(background),
                    ...(background === undefined
                      ? {}
                      : {properties: outputMediaProperties(background)}),
                  };
          return {
            id,
            kind,
            ...(backgroundOverride === undefined ? {} : {backgroundOverride}),
            source: 'service',
            ...((isItemOfKind(entry, 'song') ||
              isItemOfKind(entry, 'slides') ||
              isItemOfKind(entry, 'bible') ||
              isItemOfKind(entry, 'sermon')) &&
            cardOffset(entry)
              ? {cardOffset: 1 as const}
              : {}),
            ...(theme === undefined ? {} : {theme}),
            ...(title === undefined
              ? {}
              : {title: title.slice(0, LIVE_STATE_LIMITS.textCharacters)}),
            ...(song === undefined || broadcastSongTitle(song) === song.title
              ? {}
              : {
                  broadcastSongTitle: broadcastSongTitle(song).slice(
                    0,
                    LIVE_STATE_LIMITS.textCharacters,
                  ),
                }),
            ...('memo' in entry && typeof entry.memo === 'string'
              ? {memo: entry.memo.slice(0, LIVE_STATE_LIMITS.textCharacters)}
              : {}),
            ...(entry.overlays === undefined
              ? {}
              : {overlays: projectedItemOverlays(entry)}),
          } satisfies LiveThemeItem;
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
