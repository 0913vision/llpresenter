import type {
  LibrarySong,
  ServiceDocument,
  ServiceEntry,
  TemplateDocument,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSongId,
  createTemplateId,
  noticeSetIdSchema,
  translationIdSchema,
} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import {parseTemplate, type ServiceItem} from '@shared/schema/service';
import type {Result} from '@shared/result';

function sample<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error('A sample id is invalid');
  return result.value;
}

/** Ids of the sample 틀, past service, songs, and items. */
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

/** A 틀 with two populated sections followed by two empty sections. */
export const templateOrder: readonly ServiceItem[] = [
  {id: ids.praise, header: '찬양'},
  {id: ids.doxology, song: ids.firstSong, arrangement: '주일용'},
  {id: ids.nearer, song: ids.secondSong},
  {id: ids.word, header: '말씀'},
  {
    id: ids.psalm,
    bible: {
      translation: sample(parsePayload(translationIdSchema, 'krv')),
      ref: '시편 23:1-6',
      split: 'verse',
      reference: 'first',
      verseNumbers: true,
      translationName: false,
    },
  },
  {id: ids.offering, header: '헌금 찬양'},
  {id: ids.closing, header: '광고'},
];

/** Sample media and notice items for the tree labels. */
export const otherItems: readonly ServiceItem[] = [
  {
    id: createServiceItemId('80000000-0000-4000-8000-000000000001'),
    media: createMediaId('90000000-0000-4000-8000-000000000001'),
  },
  {
    id: createServiceItemId('80000000-0000-4000-8000-000000000002'),
    notice: sample(
      parsePayload(noticeSetIdSchema, '90000000-0000-4000-8000-000000000002'),
    ),
  },
  {id: createServiceItemId('80000000-0000-4000-8000-000000000003')},
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
export function legacyTemplateDocument(): TemplateDocument {
  const legacy = {
    ...templateDocument.template,
    order: templateOrder.map(item => {
      if (item.id === ids.offering) {
        return {
          id: item.id,
          slot: 'song',
          title: '헌금 찬양',
          future: {keep: true},
        };
      }
      if (item.id === ids.closing) {
        return {id: item.id, slot: 'bible', title: '광고'};
      }
      return item;
    }),
  };
  const parsed = parseTemplate(JSON.stringify(legacy), 'legacy.llservice');
  if (!parsed.ok) throw new Error('The legacy template could not be read');
  return {...templateDocument, template: parsed.value.data};
}

export const pastDocument: ServiceDocument = {
  service: {
    format: 'llservice',
    schemaVersion: 1,
    id: ids.past,
    name: '지난 주일 예배',
    date: '2026-10-25T09:30',
    order: [
      {id: ids.pastHeader, header: '찬양'},
      {id: ids.pastSong, song: ids.firstSong},
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
