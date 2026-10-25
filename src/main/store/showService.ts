import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';
import type {MediaChoice} from '@shared/live';
import type {LoadedFile} from '@shared/schema/fileFormat';
import type {Label} from '@shared/schema/labels';
import {
  isItemOfKind,
  type Service,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {ShowRow, ShowService, ShowTile} from '@shared/schema/showService';
import type {Slide, Song} from '@shared/schema/song';

/** A document's content and whether a newer app version wrote it. */
type Shown<T> = Pick<LoadedFile<T>, 'data' | 'access'>;

type SongLibrary = ReadonlyMap<string, Shown<Song>>;

export interface ShowServiceSources {
  readonly service: Shown<Service>;
  /** The song library, by song id. */
  readonly songs: SongLibrary;
  readonly labels: readonly Label[];
  readonly revision: number;
  readonly backgrounds?: ReadonlyMap<string, MediaChoice>;
}

/**
 * Turns the open 예배 순서 into what 진행 shows: a row per item, the tiles of
 * each song item in its 구성 order, and the 이름표 jump keys. Row ids are the
 * item ids, so the live state keeps pointing at the same item after a change.
 * A file from a newer app version shows as read-only.
 */
export function buildShowService({
  service,
  songs,
  labels,
  revision,
  backgrounds = new Map(),
}: ShowServiceSources): ShowService {
  const {id, name, order} = service.data;
  return {
    revision,
    id,
    name,
    readOnly: service.access === 'readOnly',
    rows: order.map(item => rowOf(item, songs, backgrounds)),
    tiles: tilesOf(order, songs, labels),
    jumpKeys: jumpKeysOf(labels),
  };
}

function tilesOf(
  order: Service['order'],
  songs: SongLibrary,
  labels: readonly Label[],
): Record<string, readonly ShowTile[]> {
  const colors = new Map(labels.map(({name, color}) => [name, color]));
  const tiles: Record<string, readonly ShowTile[]> = {};
  for (const item of order) {
    if (!isItemOfKind(item, 'song')) {
      continue;
    }
    const song = songs.get(item.song);
    if (song !== undefined) {
      tiles[item.id] = songTiles(song.data, colors, item.arrangement);
    }
  }
  return tiles;
}

function rowOf(
  item: ServiceItem,
  songs: SongLibrary,
  backgrounds: ReadonlyMap<string, MediaChoice>,
): ShowRow {
  const {id} = item;
  if (isItemOfKind(item, 'header')) {
    return {kind: 'header', id, title: item.header};
  }
  if (isItemOfKind(item, 'song')) {
    return songRow(item, songs.get(item.song), backgrounds);
  }
  if (isItemOfKind(item, 'slot')) {
    return {kind: 'slot', id, title: item.title};
  }
  if (isItemOfKind(item, 'bible')) {
    return {kind: 'bible', id, title: item.bible.ref};
  }
  if (isItemOfKind(item, 'media')) {
    return {kind: 'media', id, title: ''};
  }
  if (isItemOfKind(item, 'notice')) {
    return {kind: 'notice', id, title: ''};
  }
  return {kind: 'unknown', id, title: '', problem: 'unknown-kind'};
}

/** The item's override takes precedence even when its media cannot be found. */
export function songBackgroundId(
  item: ServiceItemOf<'song'>,
  song: Song,
): string | undefined {
  return item.background ?? song.background;
}

function songRow(
  item: ServiceItemOf<'song'>,
  song: Shown<Song> | undefined,
  backgrounds: ReadonlyMap<string, MediaChoice>,
): ShowRow {
  const {id} = item;
  if (song === undefined) {
    return {kind: 'song', id, title: '', problem: 'missing-song'};
  }
  const {title} = song.data;
  const mediaId = songBackgroundId(item, song.data);
  const background =
    mediaId === undefined ? undefined : backgrounds.get(mediaId);
  const problem =
    mediaId !== undefined && background === undefined
      ? 'missing-background'
      : song.access === 'readOnly'
        ? 'newer-version'
        : undefined;
  return {
    kind: 'song',
    id,
    title,
    ...(problem === undefined ? {} : {problem}),
    ...(background === undefined ? {} : {background}),
  };
}

export function songTiles(
  song: Song,
  colors: ReadonlyMap<string, LabelColor>,
  arrangement?: string,
): ShowTile[] {
  return arrangementOrder(song, arrangement).flatMap(number => {
    const slide = song.slides[number - 1];
    return slide === undefined ? [] : [tileOf(slide, colors)];
  });
}

// NOTE(0913vision): An item that names no 구성, one the song doesn't have, or
// an empty one plays the 장 in file order, so a song item always has tiles.
function arrangementOrder(song: Song, name: string | undefined) {
  const chosen = song.arrangements?.find(
    arrangement => arrangement.name === name,
  );
  return chosen !== undefined && chosen.slides.length > 0
    ? chosen.slides
    : song.slides.map((_slide, index) => index + 1);
}

function tileOf(
  slide: Slide,
  colors: ReadonlyMap<string, LabelColor>,
): ShowTile {
  const label =
    slide.label === undefined || slide.label === '' ? null : slide.label;
  return {
    label,
    labelColor:
      label === null ? NO_LABEL_COLOR : (colors.get(label) ?? NO_LABEL_COLOR),
    lines: slide.lines,
  };
}

// NOTE(0913vision): When two 이름표 share a jump key, the one listed first in
// the 이름표 menu keeps it.
export function jumpKeysOf(labels: readonly Label[]): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const {name, key} of labels) {
    if (key !== null && !Object.hasOwn(keys, key)) {
      keys[key] = name;
    }
  }
  return keys;
}
