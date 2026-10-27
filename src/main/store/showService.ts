import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';
import type {MediaChoice} from '@shared/live';
import type {LoadedFile} from '@shared/schema/fileFormat';
import {
  isGroupedSong,
  type AnySong,
  type GroupedSong,
  type SongGroup,
} from '@shared/schema/groupedSong';
import type {Label} from '@shared/schema/labels';
import {
  isItemOfKind,
  type Service,
  type ServiceItem,
  type ServiceItemOf,
} from '@shared/schema/service';
import {
  SHOW_SERVICE_LIMITS,
  type ShowRow,
  type ShowService,
  type ShowTile,
} from '@shared/schema/showService';
import type {Slide} from '@shared/schema/song';
import {playbackGroupIds, playbackOrder} from '@shared/songOrder';

export {SHOW_SERVICE_LIMITS} from '@shared/schema/showService';

/** A document's content and whether a newer app version wrote it. */
type Shown<T> = Pick<LoadedFile<T>, 'data' | 'access'>;

type SongLibrary = ReadonlyMap<string, Shown<AnySong>>;

export interface ShowServiceSources {
  readonly service: Shown<Service>;
  /** The song library, by song id. */
  readonly songs: SongLibrary;
  readonly labels: readonly Label[];
  readonly revision: number;
  readonly backgrounds?: ReadonlyMap<string, MediaChoice>;
}

export interface ProjectedSongTiles {
  readonly tiles: readonly ShowTile[];
  readonly capped: boolean;
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
  const colors = new Map(
    labels.map(({name: labelName, color}) => [labelName, color]),
  );
  const itemTiles: Record<string, readonly ShowTile[]> = {};
  const cappedItems = new Set<string>();

  for (const item of order) {
    if (!isItemOfKind(item, 'song')) continue;
    const song = songs.get(item.song);
    if (song === undefined) continue;
    const projected = projectSongTiles(song.data, colors, item.arrangement);
    if (projected.capped) {
      cappedItems.add(item.id);
      itemTiles[item.id] = [];
    } else {
      itemTiles[item.id] = projected.tiles;
    }
  }

  const rowSources: RowSources = {songs, backgrounds, cappedItems};
  return {
    revision,
    id,
    name,
    readOnly: service.access === 'readOnly',
    rows: order.map(item => rowOf(item, rowSources)),
    tiles: itemTiles,
    jumpKeys: jumpKeysOf(labels),
  };
}

interface RowSources {
  readonly songs: SongLibrary;
  readonly backgrounds: ReadonlyMap<string, MediaChoice>;
  readonly cappedItems: ReadonlySet<string>;
}

function rowOf(item: ServiceItem, sources: RowSources): ShowRow {
  const {id} = item;
  if (isItemOfKind(item, 'header')) {
    return {kind: 'header', id, title: item.header};
  }
  if (isItemOfKind(item, 'song')) {
    return songRow(item, sources.songs.get(item.song), sources);
  }
  if (isItemOfKind(item, 'slot')) {
    return {kind: 'slot', id, title: item.title, accepts: item.slot};
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
  song: AnySong,
): string | undefined {
  return item.background ?? song.background;
}

function songRow(
  item: ServiceItemOf<'song'>,
  song: Shown<AnySong> | undefined,
  sources: RowSources,
): ShowRow {
  const {id} = item;
  if (song === undefined) {
    return {kind: 'song', id, title: '', problem: 'missing-song'};
  }
  const {title} = song.data;
  const mediaId = songBackgroundId(item, song.data);
  const background =
    mediaId === undefined ? undefined : sources.backgrounds.get(mediaId);
  const capped = sources.cappedItems.has(item.id);
  // TODO(0913vision): Switch 'unknown-kind' to a dedicated tile-limit
  // problem in group-7.
  const problem = capped
    ? 'unknown-kind'
    : mediaId !== undefined && background === undefined
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

/**
 * Projects a song's slides to tiles and indicates whether the tile count hit the
 * expansion cap. An oversized expansion emits an empty tile set and flags capped.
 */
export function projectSongTiles(
  song: AnySong,
  colors: ReadonlyMap<string, LabelColor>,
  arrangement?: string,
): ProjectedSongTiles {
  if (isGroupedSong(song)) {
    return projectGroupedSongTiles(song, colors, arrangement);
  }
  const order = playbackOrder(song, arrangement);
  const tiles: ShowTile[] = [];
  for (const number of order) {
    const slide = song.slides[number - 1];
    if (slide === undefined) continue;
    if (tiles.length >= SHOW_SERVICE_LIMITS.tiles) {
      return {tiles: [], capped: true};
    }
    tiles.push(tileOf(slide, colors));
  }
  return {tiles, capped: false};
}

function projectGroupedSongTiles(
  song: GroupedSong,
  colors: ReadonlyMap<string, LabelColor>,
  arrangement?: string,
): ProjectedSongTiles {
  const groupIds = playbackGroupIds(song, arrangement);

  const groupsById = new Map<string, SongGroup>(
    song.groups.map(group => [group.id, group]),
  );
  const tiles: ShowTile[] = [];

  for (const groupId of groupIds) {
    const group = groupsById.get(groupId);
    if (group === undefined) continue;
    const label = group.name === '' ? null : group.name;
    const labelColor =
      label === null ? NO_LABEL_COLOR : (colors.get(label) ?? NO_LABEL_COLOR);

    for (let slideIndex = 0; slideIndex < group.slides.length; slideIndex++) {
      const slide = group.slides[slideIndex];
      if (slide === undefined) continue;
      if (tiles.length >= SHOW_SERVICE_LIMITS.tiles) {
        return {tiles: [], capped: true};
      }
      tiles.push({
        label,
        labelColor,
        lines: slide.lines,
        sourceSlide: {
          songId: song.id,
          groupId: group.id,
          slideIndex,
        },
        ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
      });
    }
  }

  return {tiles, capped: false};
}

export function songTiles(
  song: AnySong,
  colors: ReadonlyMap<string, LabelColor>,
  arrangement?: string,
): ShowTile[] {
  return [...projectSongTiles(song, colors, arrangement).tiles];
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
