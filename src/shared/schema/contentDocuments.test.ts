import {describe, expect, it} from 'vitest';
import {
  parseLibrarySongs,
  parseServiceChange,
  parseServiceEntries,
  parseSongChange,
  parseSongDocument,
  parseTemplateChange,
  parseTemplateDocument,
  parseTemplateEntries,
  ENTRY_ITEM_COUNT_MAX,
} from './contentDocuments';

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const TEMPLATE_ID = 'c63a2e74-9a3b-4c4d-8e5f-607182930415';

function songDocument() {
  return {
    song: {
      format: 'llsong',
      schemaVersion: 2,
      id: SONG_ID,
      title: '만복의 근원 하나님',
      groups: [
        {
          id: '00000000-0000-4000-8000-000000000101',
          name: '',
          slides: [{lines: ['Invented contract line']}],
        },
      ],
    },
    revision: 2,
    access: 'editable',
  };
}

function librarySong() {
  return {
    id: SONG_ID,
    title: '만복의 근원 하나님',
    slideCount: 3,
    access: 'readOnly',
    usedBy: [{id: SERVICE_ID, name: '주일 예배'}],
  };
}

describe('parseSongDocument', () => {
  it('rejects legacy wire documents instead of migrating renderer messages', () => {
    const original = songDocument();
    const {groups: _groups, ...header} = original.song;
    expect(
      parseSongDocument({
        ...original,
        song: {
          ...header,
          schemaVersion: 1,
          slides: [{lines: ['Invented legacy line']}],
        },
      }).ok,
    ).toBe(false);
    expect(
      parseSongChange({
        songId: SONG_ID,
        document: {
          ...original,
          song: {...header, schemaVersion: 1, slides: []},
        },
      }).ok,
    ).toBe(false);
    expect(
      parseSongDocument({
        ...original,
        song: {...original.song, schemaVersion: 1},
      }).ok,
    ).toBe(false);
  });
  it('accepts a song with its revision, and no song', () => {
    expect(parseSongDocument(songDocument())).toEqual({
      ok: true,
      value: songDocument(),
    });
    expect(parseSongDocument(null)).toEqual({ok: true, value: null});
  });

  it.each([
    ['a revision of zero', {revision: 0}, 'revision'],
    ['an unknown access', {access: 'locked'}, 'access'],
  ])('rejects %s', (_name, change, field) => {
    const parsed = parseSongDocument({...songDocument(), ...change});

    expect(parsed.ok ? null : parsed.error.field).toBe(field);
  });

  it('rejects a 템플릿 answer that is a list', () => {
    expect(parseTemplateDocument([]).ok).toBe(false);
  });
});

describe('the list checks', () => {
  it('accepts lists of songs, 예배 순서, and 템플릿', () => {
    expect(parseLibrarySongs([librarySong()])).toEqual({
      ok: true,
      value: [librarySong()],
    });
    const entry = {
      id: SERVICE_ID,
      name: '주일 예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    };
    expect(parseServiceEntries([entry])).toEqual({ok: true, value: [entry]});
    const template = {id: TEMPLATE_ID, name: '주일', access: 'editable'};
    expect(parseTemplateEntries([template])).toEqual({
      ok: true,
      value: [template],
    });
  });

  it('accepts an item count from zero to the limit on both entries', () => {
    for (const itemCount of [0, 9, ENTRY_ITEM_COUNT_MAX]) {
      const service = {
        id: SERVICE_ID,
        name: '주일 예배',
        date: '2026-11-01T11:00',
        access: 'editable',
        itemCount,
      };
      const template = {
        id: TEMPLATE_ID,
        name: '주일',
        access: 'editable',
        itemCount,
      };
      expect(parseServiceEntries([service])).toEqual({
        ok: true,
        value: [service],
      });
      expect(parseTemplateEntries([template])).toEqual({
        ok: true,
        value: [template],
      });
    }
  });

  it.each([-1, 1.5, ENTRY_ITEM_COUNT_MAX + 1, '9'])(
    'rejects the item count %j',
    itemCount => {
      const template = {id: TEMPLATE_ID, name: '주일', access: 'editable'};
      expect(parseTemplateEntries([{...template, itemCount}])).toMatchObject({
        ok: false,
        error: {field: '0.itemCount'},
      });
    },
  );

  it('rejects a list with a bad entry, and a list that is an object', () => {
    expect(
      parseLibrarySongs([{...librarySong(), slideCount: -1}]),
    ).toMatchObject({ok: false, error: {field: '0.slideCount'}});
    expect(parseLibrarySongs({}).ok).toBe(false);
  });
});

describe('the change checks', () => {
  it('accepts a changed document and a deleted one', () => {
    const changed = {songId: SONG_ID, document: songDocument()};
    expect(parseSongChange(changed)).toEqual({ok: true, value: changed});
    const deleted = {serviceId: SERVICE_ID, document: null};
    expect(parseServiceChange(deleted)).toEqual({ok: true, value: deleted});
  });

  it('rejects a change without the id', () => {
    expect(parseSongChange({document: null}).ok).toBe(false);
  });

  it('rejects a change whose document has another id', () => {
    const other = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const service = {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '주일 예배',
      date: '2026-11-01T11:00',
      order: [],
    };
    const template = {
      format: 'llservice',
      schemaVersion: 1,
      id: TEMPLATE_ID,
      name: '주일',
      order: [],
    };

    expect(
      parseSongChange({songId: other, document: songDocument()}),
    ).toMatchObject({ok: false, error: {field: 'document'}});
    expect(
      parseServiceChange({
        serviceId: other,
        document: {service, revision: 1, access: 'editable'},
      }),
    ).toMatchObject({ok: false, error: {field: 'document'}});
    expect(
      parseTemplateChange({
        templateId: other,
        document: {template, revision: 1, access: 'editable'},
      }),
    ).toMatchObject({ok: false, error: {field: 'document'}});
  });
});
