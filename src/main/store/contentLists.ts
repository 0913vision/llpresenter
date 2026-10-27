import {
  ENTRY_ITEM_COUNT_MAX,
  type LibrarySong,
  type ServiceDocument,
  type ServiceEntry,
  type SongDocument,
  type TemplateDocument,
  type TemplateEntry,
} from '@shared/schema/contentDocuments';
import {
  isItemOfKind,
  type Service,
  type Template,
} from '@shared/schema/service';
import {sourceSlideCount, type GroupedSong} from '@shared/schema/groupedSong';
import type {StoredDocument} from './documents';

const TITLES = new Intl.Collator('ko', {numeric: true});

/**
 * The 라이브러리 rows by title, each with the 예배 순서 that use the song (05,
 * "Header": "예배 순서 2곳" and its tooltip).
 */
export function librarySongs(
  songs: ReadonlyArray<StoredDocument<GroupedSong>>,
  services: ReadonlyArray<StoredDocument<Service>>,
): readonly LibrarySong[] {
  return songs
    .map(({data, access}) => ({
      id: data.id,
      title: data.title,
      slideCount: sourceSlideCount(data),
      access,
      usedBy: services
        .filter(service => usesSong(service.data, data.id))
        .map(service => ({id: service.data.id, name: service.data.name})),
    }))
    .sort((a, b) => TITLES.compare(a.title, b.title));
}

// NOTE(0913vision): The documents are in memory already, so a list counts
// their items each time instead of keeping a count on save.
function itemCount({order}: Service | Template): number {
  return Math.min(
    order.filter(item => !isItemOfKind(item, 'header')).length,
    ENTRY_ITEM_COUNT_MAX,
  );
}

/** The 예배 순서 list, the latest date first. */
export function serviceEntries(
  services: ReadonlyArray<StoredDocument<Service>>,
): readonly ServiceEntry[] {
  return services
    .map(({data, access}) => ({
      id: data.id,
      name: data.name,
      date: data.date,
      access,
      itemCount: itemCount(data),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The 틀 list by name. */
export function templateEntries(
  templates: ReadonlyArray<StoredDocument<Template>>,
): readonly TemplateEntry[] {
  return templates
    .map(({data, access}) => ({
      id: data.id,
      name: data.name,
      access,
      itemCount: itemCount(data),
    }))
    .sort((a, b) => TITLES.compare(a.name, b.name));
}

export function songDocument({
  data,
  revision,
  access,
}: StoredDocument<GroupedSong>): SongDocument {
  return {song: data, revision, access};
}

export function serviceDocument({
  data,
  revision,
  access,
}: StoredDocument<Service>): ServiceDocument {
  return {service: data, revision, access};
}

export function templateDocument({
  data,
  revision,
  access,
}: StoredDocument<Template>): TemplateDocument {
  return {template: data, revision, access};
}

function usesSong(service: Service, songId: string): boolean {
  return service.order.some(
    item => isItemOfKind(item, 'song') && item.song === songId,
  );
}
