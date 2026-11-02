import {NO_LABEL_COLOR, type LabelColor} from '@core/labels/colors';
import type {MediaChoice} from '@core/live/state';
import type {LoadedFile} from '@core/schema/fileFormat';
import type {GroupedSong, SongGroup} from '@core/schema/groupedSong';
import type {Label} from '@core/schema/labels';
import type {MediaItem} from '@core/schema/mediaList';
import type {NoticeSet} from '@core/schema/notices';
import {
  isItemOfKind,
  type Service,
  type ServiceItem,
  type ServiceItemOf,
} from '@core/schema/service';
import {
  SHOW_SERVICE_LIMITS,
  type ShowRow,
  type ShowService,
  type ShowTile,
} from '@core/schema/showService';
import {playedGroupIds, type SongPlay} from '@core/songs/itemOrder';
import type {ServicePassages} from '../bible/servicePassages';

export {SHOW_SERVICE_LIMITS} from '@core/schema/showService';

/** A document's content and whether a newer app version wrote it. */
type Shown<T> = Pick<LoadedFile<T>, 'data' | 'access'>;

type SongLibrary = ReadonlyMap<string, Shown<GroupedSong>>;

export interface ShowServiceSources {
  readonly service: Shown<Service>;
  /** The song library, by song id. */
  readonly songs: SongLibrary;
  readonly labels: readonly Label[];
  readonly revision: number;
  readonly backgrounds?: ReadonlyMap<string, MediaChoice>;
  readonly passages?: ServicePassages;
  /** The media list by id, for the names and kinds of media items. */
  readonly media?: ReadonlyMap<string, MediaItem>;
  /** The 공지 sets by id. */
  readonly notices?: ReadonlyMap<string, NoticeSet>;
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
  passages,
  media,
  notices,
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
    const projected = projectSongTiles(song.data, colors, item);
    if (projected.capped) {
      cappedItems.add(item.id);
      itemTiles[item.id] = [];
    } else {
      itemTiles[item.id] = projected.tiles;
    }
  }

  for (const [itemId, tiles] of passages?.tiles ?? []) {
    itemTiles[itemId] = tiles;
  }
  for (const item of order) {
    const tiles = otherTiles(item, {backgrounds, media, notices});
    if (tiles !== undefined) itemTiles[item.id] = tiles;
  }
  const rowSources: RowSources = {
    songs,
    backgrounds,
    cappedItems,
    passages,
    media,
    notices,
  };
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
  readonly passages: ServicePassages | undefined;
  readonly media: ReadonlyMap<string, MediaItem> | undefined;
  readonly notices: ReadonlyMap<string, NoticeSet> | undefined;
}

const UNNAMED_MEDIA = '이름 없는 미디어';

function mediaTitle(media: MediaItem): string {
  return media.name === '' ? UNNAMED_MEDIA : media.name;
}

interface OtherSources {
  readonly backgrounds: ReadonlyMap<string, MediaChoice>;
  readonly media: ReadonlyMap<string, MediaItem> | undefined;
  readonly notices: ReadonlyMap<string, NoticeSet> | undefined;
}

/**
 * The tiles of a media item (one, that outputs the media) or a 공지 item (one
 * per image, each starting the 공지 from it). Audio and missing media have no
 * tile.
 */
function otherTiles(
  item: ServiceItem,
  {backgrounds, media, notices}: OtherSources,
): readonly ShowTile[] | undefined {
  if (isItemOfKind(item, 'media')) {
    if (media === undefined) return undefined;
    const choice = backgrounds.get(item.media);
    const found = media.get(item.media);
    if (choice === undefined || found === undefined) return [];
    return [
      {
        label: null,
        labelColor: NO_LABEL_COLOR,
        lines: [mediaTitle(found)],
        media: choice,
      },
    ];
  }
  if (isItemOfKind(item, 'notice')) {
    if (notices === undefined) return undefined;
    const set = notices.get(item.notice);
    if (set === undefined) return [];
    const tiles: ShowTile[] = [];
    set.media.forEach((mediaId, position) => {
      const found = media?.get(mediaId);
      if (found === undefined || tiles.length >= SHOW_SERVICE_LIMITS.tiles) {
        return;
      }
      tiles.push({
        label: null,
        labelColor: NO_LABEL_COLOR,
        lines: [mediaTitle(found)],
        notice: {noticeId: set.id, position},
      });
    });
    return tiles;
  }
  return undefined;
}

function rowOf(item: ServiceItem, sources: RowSources): ShowRow {
  const {id} = item;
  if (isItemOfKind(item, 'header')) {
    return {kind: 'header', id, title: item.header};
  }
  if (isItemOfKind(item, 'song')) {
    return songRow(item, sources.songs.get(item.song), sources);
  }
  if (isItemOfKind(item, 'bible')) {
    const bible = sources.passages?.references.get(id);
    return {
      kind: 'bible',
      id,
      title: item.bible.ref,
      ...(bible === undefined
        ? {}
        : {bible: {...bible, verseNumbers: item.bible.verseNumbers}}),
      ...(sources.passages?.unavailable.has(id)
        ? {problem: 'missing-bible' as const}
        : {}),
    };
  }
  if (isItemOfKind(item, 'media')) {
    const found = sources.media?.get(item.media);
    const problem =
      sources.media === undefined ||
      found?.kind === 'audio' ||
      sources.backgrounds.has(item.media)
        ? {}
        : {problem: 'missing-media' as const};
    return {
      kind: 'media',
      id,
      title: found === undefined ? '' : mediaTitle(found),
      ...problem,
    };
  }
  if (isItemOfKind(item, 'notice')) {
    const set = sources.notices?.get(item.notice);
    return {
      kind: 'notice',
      id,
      title: set?.name ?? '',
      ...(sources.notices === undefined || set !== undefined
        ? {}
        : {problem: 'missing-media' as const}),
    };
  }
  return {kind: 'unknown', id, title: '', problem: 'unknown-kind'};
}

/** The item's override takes precedence even when its media cannot be found. */
export function songBackgroundId(
  item: ServiceItemOf<'song'>,
  song: GroupedSong,
): string | undefined {
  return item.background ?? song.background;
}

function songRow(
  item: ServiceItemOf<'song'>,
  song: Shown<GroupedSong> | undefined,
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
  const problem = capped
    ? 'tile-limit'
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
  song: GroupedSong,
  colors: ReadonlyMap<string, LabelColor>,
  play: SongPlay = {},
): ProjectedSongTiles {
  const groupIds = playedGroupIds(song, play);

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
  song: GroupedSong,
  colors: ReadonlyMap<string, LabelColor>,
  play: SongPlay = {},
): ShowTile[] {
  return [...projectSongTiles(song, colors, play).tiles];
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
