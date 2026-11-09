import {NO_LABEL_COLOR, type LabelColor} from '@core/labels/colors';
import type {MediaChoice} from '@core/live/state';
import type {LoadedFile} from '@core/schema/fileFormat';
import type {Song, SongSlide} from '@core/schema/song';
import type {Label} from '@core/schema/labels';
import type {MediaItem} from '@core/schema/mediaList';
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
import {projectSlides} from '@core/presentation/slides';
import type {ServicePassages} from '../bible/servicePassages';

export {SHOW_SERVICE_LIMITS} from '@core/schema/showService';

/** A document's content and whether a newer app version wrote it. */
type Shown<T> = Pick<LoadedFile<T>, 'data' | 'access'>;

type SongLibrary = ReadonlyMap<string, Shown<Song>>;

export interface ShowServiceSources {
  readonly service: Shown<Service>;
  /** The song library, by song id. */
  readonly songs: SongLibrary;
  readonly labels: readonly Label[];
  readonly revision: number;
  readonly serviceRevision?: number;
  readonly backgrounds?: ReadonlyMap<string, MediaChoice>;
  readonly passages?: ServicePassages;
  /** The media list by id, for the names and kinds of media items. */
  readonly media?: ReadonlyMap<string, MediaItem>;
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
  serviceRevision,
  backgrounds = new Map(),
  passages,
  media,
}: ShowServiceSources): ShowService {
  const {id, name, order} = service.data;
  const colors = new Map(
    labels.map(({name: labelName, color}) => [labelName, color]),
  );
  const itemTiles: Record<string, readonly ShowTile[]> = {};
  const cappedItems = new Set<string>();

  for (const item of order) {
    if (!isItemOfKind(item, 'song')) continue;
    const projected = projectSongTiles(
      {id: item.song, slides: item.slides},
      colors,
    );
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
    const tiles = otherTiles(item, {backgrounds, media, passages});
    if (tiles !== undefined) itemTiles[item.id] = tiles;
  }
  const rowSources: RowSources = {
    songs,
    backgrounds,
    cappedItems,
    passages,
    media,
    serviceRevision,
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
  readonly serviceRevision: number | undefined;
  readonly songs: SongLibrary;
  readonly backgrounds: ReadonlyMap<string, MediaChoice>;
  readonly cappedItems: ReadonlySet<string>;
  readonly passages: ServicePassages | undefined;
  readonly media: ReadonlyMap<string, MediaItem> | undefined;
}

const UNNAMED_MEDIA = '이름 없는 미디어';

function mediaTitle(media: MediaItem): string {
  return media.name === '' ? UNNAMED_MEDIA : media.name;
}

interface OtherSources {
  readonly backgrounds: ReadonlyMap<string, MediaChoice>;
  readonly media: ReadonlyMap<string, MediaItem> | undefined;
  readonly passages: ServicePassages | undefined;
}

/**
 * The single tile of a media item. Audio and missing media have no tile.
 */
function otherTiles(
  item: ServiceItem,
  {backgrounds, media, passages}: OtherSources,
): readonly ShowTile[] | undefined {
  if (isItemOfKind(item, 'slides')) {
    return projectSlides(item, media, passages?.slides?.get(item.id));
  }
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
  if (isItemOfKind(item, 'slides')) {
    const background =
      item.background === undefined
        ? undefined
        : sources.backgrounds.get(item.background);
    const missingBackgroundName =
      item.background === undefined
        ? undefined
        : sources.media?.get(item.background)?.name;
    return {
      kind: 'slides',
      id,
      title: item.slides.name,
      form: item.slides.form,
      ...(sources.serviceRevision === undefined
        ? {}
        : {sourceRevision: sources.serviceRevision}),
      ...(item.theme === undefined ? {} : {theme: item.theme}),
      ...(background === undefined ? {} : {background}),
      ...(item.background !== undefined && background === undefined
        ? {
            problem: 'missing-background' as const,
            ...(missingBackgroundName === undefined
              ? {}
              : {missingBackgroundName}),
          }
        : item.slides.slides.some(
              slide =>
                'media' in slide &&
                sources.media?.get(slide.media)?.kind !== 'image',
            )
          ? {problem: 'missing-media' as const}
          : sources.passages?.unavailable.has(id)
            ? {problem: 'missing-bible' as const}
            : {}),
    };
  }
  if (isItemOfKind(item, 'bible')) {
    const bible = sources.passages?.references.get(id);
    return {
      kind: 'bible',
      id,
      title: item.bible.ref,
      ...(bible === undefined
        ? {}
        : {
            bible: {
              ...bible,
              verseNumbers: item.bible.verseNumbers,
              translationName: item.bible.translationName,
              reference: item.bible.reference,
              ...(item.theme === undefined ? {} : {theme: item.theme}),
            },
          }),
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
  const missingBackgroundName =
    background === undefined && mediaId !== undefined
      ? sources.media?.get(mediaId)?.name
      : undefined;
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
    ...(item.theme === undefined ? {} : {theme: item.theme}),
    ...(problem === undefined ? {} : {problem}),
    ...(background === undefined ? {} : {background}),
    ...(missingBackgroundName === undefined ? {} : {missingBackgroundName}),
  };
}

/** Projects the supplied deck directly, including service-local edits. */
export function projectSongTiles(
  song: Pick<Song, 'id'> & {readonly slides: readonly SongSlide[]},
  colors: ReadonlyMap<string, LabelColor>,
): ProjectedSongTiles {
  if (song.slides.length > SHOW_SERVICE_LIMITS.tiles) {
    return {tiles: [], capped: true};
  }
  return {
    capped: false,
    tiles: song.slides.map(slide => ({
      label: slide.label ?? null,
      labelColor:
        slide.label === undefined
          ? NO_LABEL_COLOR
          : (colors.get(slide.label) ?? NO_LABEL_COLOR),
      lines: slide.lines,
      ...(slide.titleSlide === undefined ? {} : {titleSlide: slide.titleSlide}),
      ...(slide.titleLayout === undefined
        ? {}
        : {titleLayout: slide.titleLayout}),
      sourceSlide: {songId: song.id, slideId: slide.id},
      ...(slide.transition === undefined ? {} : {transition: slide.transition}),
      ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
    })),
  };
}

export function songTiles(
  song: Song,
  colors: ReadonlyMap<string, LabelColor>,
): ShowTile[] {
  return [...projectSongTiles(song, colors).tiles];
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
