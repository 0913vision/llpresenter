import {ipcMain} from 'electron';
import {serviceEndpoints} from '@contracts/ipc/service';
import {
  parseSlidesProjection,
  type SlidesProjection,
} from '@core/schema/slidesProjection';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import type {ShowTile} from '@core/schema/showService';
import type {ContentStore} from '../store/contentStore';
import type {Logger} from '../log';
import type {SettingsReader} from '@core/schema/settingsReader';

export interface SlidesProjectionReader {
  readonly get: (
    serviceId: string,
    itemId: string,
    revision: number,
  ) => readonly ShowTile[] | undefined;
  readonly subscribe: (listener: () => void) => () => void;
}

function matchesItem(
  item: ServiceItemOf<'slides'>,
  tiles: readonly ShowTile[],
): boolean {
  const indices = new Map(
    item.slides.slides.map((slide, index) => [slide.id, index]),
  );
  let position = -1;
  let part = 0;
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];
    if (tile?.sourceSlideId === undefined || tile.kind !== item.slides.form) {
      return false;
    }
    const at = indices.get(tile.sourceSlideId);
    if (at === undefined || at < position || at > position + 1) return false;
    if (at !== position) {
      position = at;
      part = 0;
    }
    part++;
    const source = item.slides.slides[at];
    if (source === undefined) return false;
    if ('verse' in source) {
      if (tile.biblePart !== part) return false;
      const continues = tiles[index + 1]?.sourceSlideId === tile.sourceSlideId;
      if (tile.continued !== continues) return false;
    } else if (part !== 1 || tile.biblePart !== undefined) return false;
    if (tile.picture !== ('media' in source ? source.media : undefined)) {
      return false;
    }
  }
  return position === item.slides.slides.length - 1;
}

/** Retains one checked live sequence so automatic advance outlives the control view. */
export function registerSlidesProjection({
  content: loading,
  settings: loadingSettings,
  log,
}: {
  readonly content: Promise<Pick<
    ContentStore,
    'service' | 'openServiceId'
  > | null>;
  readonly settings: Promise<SettingsReader | null>;
  readonly log: Logger;
}): SlidesProjectionReader & {readonly dispose: () => void} {
  let disposed = false;
  let content: Pick<ContentStore, 'service' | 'openServiceId'> | null = null;
  let projection: SlidesProjection | null = null;
  let settings: SettingsReader | null = null;
  let stopSettings: (() => void) | undefined;
  const listeners = new Set<() => void>();
  void Promise.all([loading, loadingSettings]).then(
    ([source, reader]) => {
      if (disposed) return;
      content = source;
      settings = reader;
      stopSettings = reader?.subscribe(document => {
        if (!['themes', 'screens', 'bibleCuts'].includes(document.name)) return;
        projection = null;
        for (const listener of listeners) listener();
      });
    },
    (error: unknown) =>
      log.error('Could not read slides projection source', error),
  );
  const matchesMeasurement = (next: SlidesProjection): boolean => {
    if (settings === null) return false;
    try {
      return (
        settings.get('themes').revision === next.measurement.themes &&
        settings.get('screens').revision === next.measurement.screens &&
        settings.get('bibleCuts').revision === next.measurement.bibleCuts
      );
    } catch (error: unknown) {
      log.warn('Could not read slides measurement revisions', error);
      return false;
    }
  };
  const receive = (_event: Electron.IpcMainEvent, value: unknown): void => {
    const parsed = parseSlidesProjection(value);
    if (!parsed.ok) {
      log.warn('Dropped an invalid slides projection', parsed.error);
      return;
    }
    const next = parsed.value;
    const document = content?.service(next.serviceId);
    const item = document?.service.order.find(item => item.id === next.itemId);
    if (
      disposed ||
      content?.openServiceId !== next.serviceId ||
      document?.revision !== next.revision ||
      item === undefined ||
      !isItemOfKind(item, 'slides') ||
      !matchesMeasurement(next) ||
      !matchesItem(item, next.tiles)
    ) {
      return;
    }
    projection = next;
    for (const listener of listeners) listener();
  };
  ipcMain.on(serviceEndpoints.slidesProjection.channel, receive);
  return {
    get: (serviceId, itemId, revision) =>
      projection?.serviceId === serviceId &&
      projection.itemId === itemId &&
      projection.revision === revision &&
      matchesMeasurement(projection)
        ? projection.tiles
        : undefined,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      disposed = true;
      stopSettings?.();
      settings = null;
      projection = null;
      content = null;
      listeners.clear();
      ipcMain.removeListener(
        serviceEndpoints.slidesProjection.channel,
        receive,
      );
    },
  };
}
