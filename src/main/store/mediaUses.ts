import {ipcMain} from 'electron';
import {mediaEndpoints} from '@contracts/ipc/media';
import {countMediaUses} from '@core/media/mediaUses';
import {parseMediaUsesRequest} from '@core/schema/mediaUses';
import type {Logger} from '../log';
import type {OpenedContent} from './openContent';
import type {MediaStore} from './mediaStore';
import type {SettingsStore} from './settingsStore';

interface MediaUseOwners {
  readonly media: Promise<MediaStore | null>;
  readonly settings: Promise<SettingsStore | null>;
  readonly content: Promise<OpenedContent | null>;
}

/**
 * Answers `media:uses` from the documents main already holds in memory.
 *
 * @returns A function that stops answering.
 */
export function registerMediaUses(
  owners: MediaUseOwners,
  log: Logger,
): () => void {
  ipcMain.handle(
    mediaEndpoints.uses.channel,
    async (_event, value: unknown) => {
      const request = parseMediaUsesRequest(value);
      if (!request.ok) {
        log.warn('dropped a malformed media uses request', request.error);
        throw new Error('Invalid media uses request');
      }
      const [media, settings, opened] = await Promise.all([
        owners.media,
        owners.settings,
        owners.content,
      ]);
      if (media === null || settings === null || opened === null) {
        throw new Error('The documents that use media are unavailable');
      }
      const props = settings.get('props');
      const themes = settings.get('themes');
      const macros = settings.get('macros');
      if (
        props.name !== 'props' ||
        themes.name !== 'themes' ||
        macros.name !== 'macros'
      ) {
        throw new Error('The settings that use media are unavailable');
      }
      return countMediaUses(request.value.mediaId, {
        media: media.get().value,
        props: props.value,
        themes: themes.value,
        macros: macros.value,
        songs: [...opened.content.storedSongs().values()].map(
          song => song.data,
        ),
        services: opened.content.storedServices().map(service => service.data),
      });
    },
  );
  return () => {
    ipcMain.removeHandler(mediaEndpoints.uses.channel);
  };
}
