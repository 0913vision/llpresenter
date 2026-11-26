import {placedOverlays} from '@core/live';
import type {SettingsReader} from '@core/schema/app/settingsReader';
import type {LiveItem} from '@core/schema/live/liveTheme';
import {LIVE_STATE_LIMITS} from '@core/schema/live/liveLimits';
import {hasSlides} from '@core/schema/services/service';
import {songIdSchema, type MediaId} from '@core/schema/common/ids';
import {parsePayload} from '@core/schema/common/payload';
import {itemTitle} from '@core/slides';
import type {ContentStore} from '../../store/content/contentStore';
import type {MediaStore} from '../../store/media/mediaStore';
import type {Logger} from '../../base/log';
import {ThemeRuntime} from './themeRuntime';
import {dispatchLogged, type LiveStore} from '../store';

const LIBRARY_ITEM = 'library:';

/** What names a live item: the songs of the 라이브러리 and the open 예배. */
export type LiveItemContent = Pick<
  ContentStore,
  'song' | 'service' | 'openServiceId'
>;

/**
 * The item an output shows by its id: a song of the 라이브러리
 * (`library:<song id>`), or an item with slides of the open 예배, without the
 * overlays whose media file `isMissing` says can't be found.
 */
export function liveItemOf(
  content: LiveItemContent,
  id: string,
  isMissing: (mediaId: MediaId) => boolean = () => false,
): LiveItem | undefined {
  return id.startsWith(LIBRARY_ITEM)
    ? librarySong(content, id)
    : serviceItem(content, id, isMissing);
}

function librarySong(
  content: LiveItemContent,
  id: string,
): LiveItem | undefined {
  const songId = parsePayload(songIdSchema, id.slice(LIBRARY_ITEM.length));
  const song = songId.ok ? content.song(songId.value)?.song : undefined;
  return song === undefined
    ? undefined
    : {id, kind: 'song', source: 'external', title: short(song.title)};
}

function serviceItem(
  content: LiveItemContent,
  id: string,
  isMissing: (mediaId: MediaId) => boolean,
): LiveItem | undefined {
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
      : {
          // NOTE(0913vision): An overlay whose file is missing is left out, so
          // no screen tries it (spec 08, "Missing media file").
          overlays: placedOverlays(
            item.overlays.filter(
              ({content: shown}) =>
                !('media' in shown) || !isMissing(shown.media),
            ),
            item.slides,
          ),
        }),
  };
}

function short(text: string): string {
  return text.slice(0, LIVE_STATE_LIMITS.textCharacters);
}

/** What the outputs' themes read; each is null when it could not be read. */
export interface ThemeOutputData {
  readonly content: Promise<LiveItemContent | null>;
  readonly settings: Promise<SettingsReader | null>;
  readonly media: Promise<Pick<MediaStore, 'subscribe'> | null>;
}

/**
 * Connects the open 예배's items and the theme settings to the outputs once
 * both are read, and has the outputs draw again when the themes, the screens
 * or the media change.
 *
 * @returns Releases the connection and every subscription.
 */
export function registerThemeOutput({
  store,
  data,
  log,
}: {
  readonly store: LiveStore;
  readonly data: ThemeOutputData;
  readonly log: Logger;
}): () => void {
  let stopped = false;
  const releases: Array<() => void> = [];
  const refresh = (): void => {
    if (!stopped) dispatchLogged(store, {type: 'themes.refresh'}, log);
  };
  Promise.all([data.content, data.settings, data.media])
    .then(([content, settings, media]) => {
      // NOTE(0913vision): A store that could not be read is logged where it
      // is opened; the outputs then draw without themes.
      if (stopped || settings === null || content === null) return;
      const runtime = new ThemeRuntime({
        settings,
        item: id =>
          liveItemOf(content, id, mediaId => store.isMediaMissing(mediaId)),
        onError: error =>
          log.warn('could not read theme output settings', error),
        onMissingTheme: id => log.warn('missing theme; using fallback', {id}),
      });
      releases.push(
        store.connectThemes(runtime),
        settings.subscribe(document => {
          if (document.name === 'themes' || document.name === 'screens') {
            refresh();
          }
        }),
      );
      if (media !== null) releases.push(media.subscribe(refresh));
      refresh();
    })
    .catch((error: unknown) =>
      log.error('could not connect theme output', error),
    );
  return () => {
    stopped = true;
    for (const release of releases.splice(0)) release();
  };
}
