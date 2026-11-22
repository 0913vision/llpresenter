import type {LabelColor} from '@core/labels/colors';
import type {LoadedFile} from '@core/schema/fileFormat';
import type {Label} from '@core/schema/labels';
import {hasSlides, type Service, type ServiceItem} from '@core/schema/service';
import type {ShowRow, ShowService, ShowTile} from '@core/schema/showService';
import type {Song} from '@core/schema/song';
import {itemTiles, itemTitle} from '@core/slides/tiles';

/** A document's content and whether a newer app version wrote it. */
type Shown<T> = Pick<LoadedFile<T>, 'data' | 'access'>;

export interface ShowServiceSources {
  readonly service: Shown<Service>;
  /** The song library, by song id. */
  readonly songs: ReadonlyMap<string, Shown<Song>>;
  readonly labels: readonly Label[];
  readonly revision: number;
  /** Whether a media item is in the list or comes with the app. */
  readonly hasMedia: (id: string) => boolean;
}

/**
 * Turns the open 예배 순서 into what 진행 shows: a row per item and the tiles
 * of its slides. Row ids are the item ids, so the live state keeps pointing at
 * the same item after a change. A file from a newer app version is read-only.
 */
export function buildShowService(sources: ShowServiceSources): ShowService {
  const {service, labels, revision} = sources;
  const {id, name, order} = service.data;
  const colors: ReadonlyMap<string, LabelColor> = new Map(
    labels.map(label => [label.name, label.color]),
  );
  const tiles: Record<string, readonly ShowTile[]> = {};
  for (const item of order) {
    if (hasSlides(item)) tiles[item.id] = itemTiles(item, colors);
  }
  return {
    revision,
    id,
    name,
    readOnly: service.access === 'readOnly',
    rows: order.map(item => rowOf(item, sources)),
    tiles,
  };
}

function rowOf(item: ServiceItem, sources: ShowServiceSources): ShowRow {
  const {id} = item;
  const title = itemTitle(item);
  if (item.kind === 'header') return {kind: 'header', id, title};
  if (!hasSlides(item)) {
    return {kind: 'unknown', id, title, problem: 'unknown-kind'};
  }
  const song = item.kind === 'song' ? sources.songs.get(item.song) : undefined;
  const missing = item.slides.some(
    ({background}) =>
      background?.kind === 'media' && !sources.hasMedia(background.media),
  );
  const problem =
    item.kind === 'song' && song === undefined
      ? 'missing-song'
      : song?.access === 'readOnly'
        ? 'newer-version'
        : missing
          ? 'missing-media'
          : undefined;
  return {
    kind: item.kind,
    id,
    title,
    ...(problem === undefined ? {} : {problem}),
    ...(item.kind === 'song' ? {song: item.song} : {}),
    ...('passage' in item ? {passage: item.passage} : {}),
  };
}
