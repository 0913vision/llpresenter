import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';
import type {Label} from '@shared/schema/labels';
import {
  isItemOfKind,
  type Service,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import type {ShowRow, ShowService, ShowTile} from '@shared/schema/showService';
import type {Slide, Song} from '@shared/schema/song';

export interface ShowServiceSources {
  readonly service: Service;
  /** The song library, by song id. */
  readonly songs: ReadonlyMap<string, Song>;
  readonly labels: readonly Label[];
  readonly revision: number;
}

/**
 * Turns the open 예배 순서 into what 진행 shows: a row per item, the tiles of
 * each song item in its 구성 order, and the 이름표 jump keys. Row ids are the
 * item ids, so the live state keeps pointing at the same item after a change.
 */
export function buildShowService({
  service,
  songs,
  labels,
  revision,
}: ShowServiceSources): ShowService {
  const colors = new Map(labels.map(({name, color}) => [name, color]));
  const tiles: Record<string, readonly ShowTile[]> = {};
  for (const item of service.order) {
    const song = isItemOfKind(item, 'song') ? songs.get(item.song) : undefined;
    if (isItemOfKind(item, 'song') && song !== undefined) {
      tiles[item.id] = songTiles(item, song, colors);
    }
  }
  return {
    revision,
    id: service.id,
    name: service.name,
    rows: service.order.map(item => rowOf(item, songs)),
    tiles,
    jumpKeys: jumpKeysOf(labels),
  };
}

function rowOf(item: ServiceItem, songs: ReadonlyMap<string, Song>): ShowRow {
  const {id} = item;
  if (isItemOfKind(item, 'header')) {
    return {kind: 'header', id, title: item.header};
  }
  if (isItemOfKind(item, 'song')) {
    const song = songs.get(item.song);
    return song === undefined
      ? {kind: 'song', id, title: '', problem: 'missing-song'}
      : {kind: 'song', id, title: song.title};
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

function songTiles(
  item: ServiceItemOf<'song'>,
  song: Song,
  colors: ReadonlyMap<string, LabelColor>,
): ShowTile[] {
  return arrangementOrder(song, item.arrangement).flatMap(number => {
    const slide = song.slides[number - 1];
    return slide === undefined ? [] : [tileOf(slide, colors)];
  });
}

/**
 * The 장 numbers in play order: the named 구성, or the file order when the
 * item names none, names one the song doesn't have, or names an empty one.
 */
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

/** Key code to 이름표 name. When two 이름표 share a key, the first keeps it. */
function jumpKeysOf(labels: readonly Label[]): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const {name, key} of labels) {
    if (key !== null && !Object.hasOwn(keys, key)) {
      keys[key] = name;
    }
  }
  return keys;
}
