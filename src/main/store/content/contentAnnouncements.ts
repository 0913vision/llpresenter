import type {
  LibrarySong,
  ServiceDocument,
  ServiceEntry,
  SongDocument,
  TemplateDocument,
  TemplateEntry,
} from '@core/schema/contentDocuments';
import type {ServiceId, SongId, TemplateId} from '@core/schema/ids';
import type {ContentCommandContext, ContentEvents} from './contentCommands';

/**
 * Reads current document projections and lists without owning a document copy,
 * persistence operation or subscription.
 */
export interface ContentAnnouncementReaders {
  readonly song: (id: string) => SongDocument | null;
  readonly service: (id: string) => ServiceDocument | null;
  readonly template: (id: string) => TemplateDocument | null;
  readonly songList: () => readonly LibrarySong[];
  readonly serviceList: () => readonly ServiceEntry[];
  readonly templateList: () => readonly TemplateEntry[];
}

/**
 * Publishes current projections and suppresses unchanged displayed lists. It
 * keeps only the three list keys, without applying edits or scheduling writes.
 */
export type ContentAnnouncements = Pick<
  ContentCommandContext,
  | 'announceSong'
  | 'announceSongDocument'
  | 'announceService'
  | 'announceTemplate'
  | 'announceList'
>;

class Announcements implements ContentAnnouncements {
  private readonly lastLists = new Map<string, string>();

  constructor(
    private readonly readers: ContentAnnouncementReaders,
    private readonly events: ContentEvents,
  ) {
    this.lastLists.set('songs', JSON.stringify(readers.songList()));
    this.lastLists.set('services', JSON.stringify(readers.serviceList()));
    this.lastLists.set('templates', JSON.stringify(readers.templateList()));
  }

  announceSong(songId: SongId): void {
    this.announceSongDocument(songId);
    this.announceLists();
  }

  announceSongDocument(songId: SongId): void {
    this.events.songChanged({songId, document: this.readers.song(songId)});
  }

  announceService(serviceId: ServiceId): void {
    this.events.serviceChanged({
      serviceId,
      document: this.readers.service(serviceId),
    });
    this.announceLists();
  }

  announceTemplate(templateId: TemplateId): void {
    this.events.templateChanged({
      templateId,
      document: this.readers.template(templateId),
    });
    this.announceLists();
  }

  // NOTE(0913vision): The lists go out only when what they show changed, so
  // typing lyrics never re-renders the 라이브러리 or the 예배 순서 list.
  private announceLists(): void {
    this.announceList(
      'songs',
      this.readers.songList(),
      this.events.songsListChanged,
    );
    this.announceList(
      'services',
      this.readers.serviceList(),
      this.events.servicesListChanged,
    );
    this.announceList(
      'templates',
      this.readers.templateList(),
      this.events.templatesListChanged,
    );
  }

  announceList<T>(
    name: string,
    value: readonly T[],
    send: (value: readonly T[]) => void,
  ): void {
    const key = JSON.stringify(value);
    if (key !== this.lastLists.get(name)) {
      this.lastLists.set(name, key);
      send(value);
    }
  }
}

/**
 * Initializes the existing list cache and publishes through the borrowed event
 * callbacks. It does not register listeners or change document state.
 */
export function createContentAnnouncements(
  readers: ContentAnnouncementReaders,
  events: ContentEvents,
): ContentAnnouncements {
  return new Announcements(readers, events);
}
