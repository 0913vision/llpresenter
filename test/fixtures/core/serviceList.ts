import type {
  LibrarySong,
  ServiceDocument,
  ServiceEntry,
  TemplateDocument,
  TemplateEntry,
} from '@core/schema/contentDocuments';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSongId,
  createTemplateId,
  translationIdSchema,
  type ServiceItemId,
  type SongId,
} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {ServiceItem, ServiceItemOf} from '@core/schema/service';
import type {Result} from '@core/common/result';

function sample<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error('A sample id is invalid');
  return result.value;
}

/** Ids of the sample 템플릿, past service, songs, and items. */
export const ids = {
  template: createTemplateId('30000000-0000-4000-8000-000000000001'),
  past: createServiceId('40000000-0000-4000-8000-000000000001'),
  created: createServiceId('40000000-0000-4000-8000-000000000002'),
  praise: createServiceItemId('50000000-0000-4000-8000-000000000001'),
  doxology: createServiceItemId('50000000-0000-4000-8000-000000000002'),
  nearer: createServiceItemId('50000000-0000-4000-8000-000000000003'),
  word: createServiceItemId('50000000-0000-4000-8000-000000000004'),
  psalm: createServiceItemId('50000000-0000-4000-8000-000000000005'),
  offering: createServiceItemId('50000000-0000-4000-8000-000000000006'),
  closing: createServiceItemId('50000000-0000-4000-8000-000000000007'),
  pastHeader: createServiceItemId('60000000-0000-4000-8000-000000000001'),
  pastSong: createServiceItemId('60000000-0000-4000-8000-000000000002'),
  firstSong: createSongId('70000000-0000-4000-8000-000000000001'),
  secondSong: createSongId('70000000-0000-4000-8000-000000000002'),
};

/** Invented song titles for the sample items. */
export const titles = {
  first: '아침 해가 뜰 때',
  second: '저녁 노을 아래서',
};

function songItem(
  id: ServiceItemId,
  song: SongId,
  name: string,
): ServiceItemOf<'song'> {
  return {id, kind: 'song', name, song, slides: []};
}

/** A 템플릿 with two populated sections followed by two empty sections. */
export const templateOrder: readonly ServiceItem[] = [
  {id: ids.praise, kind: 'header', name: '찬양'},
  songItem(ids.doxology, ids.firstSong, titles.first),
  songItem(ids.nearer, ids.secondSong, titles.second),
  {id: ids.word, kind: 'header', name: '말씀'},
  {
    id: ids.psalm,
    kind: 'bible',
    name: '시편 23:1-6',
    slides: [],
    passage: {
      translation: sample(parsePayload(translationIdSchema, 'krv')),
      ref: '시편 23:1-6',
      verseNumbers: true,
      translationName: false,
    },
  },
  {id: ids.offering, kind: 'header', name: '헌금 찬양'},
  {id: ids.closing, kind: 'header', name: '광고'},
];

/** Sample media items for the tree labels. */
export const otherItems: readonly ServiceItem[] = [
  {
    id: createServiceItemId('80000000-0000-4000-8000-000000000001'),
    kind: 'media',
    name: '인사 영상',
    slides: [],
    media: createMediaId('90000000-0000-4000-8000-000000000001'),
  },
];

export const songTitles: ReadonlyMap<string, string> = new Map([
  [ids.firstSong, titles.first],
  [ids.secondSong, titles.second],
]);

export const templateDocument: TemplateDocument = {
  template: {
    format: 'llservice',
    schemaVersion: 1,
    id: ids.template,
    name: '주일 예배',
    time: '11:00',
    order: templateOrder,
  },
  revision: 1,
  access: 'editable',
};

/** A legacy file read through the real template parser, before renderer IPC. */

export const pastDocument: ServiceDocument = {
  service: {
    format: 'llservice',
    schemaVersion: 1,
    id: ids.past,
    name: '지난 주일 예배',
    date: '2026-10-25T09:30',
    order: [
      {id: ids.pastHeader, kind: 'header', name: '찬양'},
      songItem(ids.pastSong, ids.firstSong, titles.first),
    ],
  },
  revision: 3,
  access: 'editable',
};

export const templateEntries: readonly TemplateEntry[] = [
  {id: ids.template, name: '주일 예배', access: 'editable', itemCount: 3},
];

export const serviceEntries: readonly ServiceEntry[] = [
  {
    id: ids.past,
    name: '지난 주일 예배',
    date: '2026-10-25T09:30',
    access: 'editable',
    itemCount: 1,
  },
];

export const librarySongs: readonly LibrarySong[] = [
  {
    id: ids.firstSong,
    title: titles.first,
    slideCount: 4,
    access: 'editable',
    usedBy: [],
  },
  {
    id: ids.secondSong,
    title: titles.second,
    slideCount: 3,
    access: 'editable',
    usedBy: [],
  },
];
