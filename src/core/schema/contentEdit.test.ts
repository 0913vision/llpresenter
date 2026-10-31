import {describe, expect, it} from 'vitest';
import {parseContentEdit, parseEditResult} from './contentEdit';

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const SERVICE_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const OTHER_SERVICE_ID = 'b52f1d63-8f2a-4b3c-9d4e-5f6071829304';
const TEMPLATE_ID = 'c63a2e74-9a3b-4c4d-8e5f-607182930415';
const ITEM_ID = '00000000-0000-4000-8000-000000000001';

function song() {
  return {
    format: 'llsong',
    schemaVersion: 2,
    id: SONG_ID,
    title: '만복의 근원 하나님',
    groups: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        name: '1절',
        slides: [{lines: ['Invented contract line']}],
      },
    ],
    arrangements: [
      {
        name: '주일용',
        groups: [
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000101',
        ],
      },
    ],
  };
}

function service() {
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: SERVICE_ID,
    name: '주일 예배',
    date: '2026-11-01T11:00',
    order: [{id: ITEM_ID, song: SONG_ID, arrangement: '주일용'}],
  };
}

function template() {
  const {date: _date, ...rest} = service();
  return {...rest, id: TEMPLATE_ID, time: '11:00'};
}

describe('parseContentEdit', () => {
  it('accepts a retry of queued saves without taking file paths from the renderer', () => {
    expect(parseContentEdit({type: 'saves.retry'})).toEqual({
      ok: true,
      value: {type: 'saves.retry'},
    });
    expect(
      parseContentEdit({type: 'saves.retry', file: 'C:/data/other.json'}),
    ).toEqual({ok: true, value: {type: 'saves.retry'}});
    expect(parseContentEdit({type: 'saves.retry.invalid'}).ok).toBe(false);
    expect(parseContentEdit({type: null}).ok).toBe(false);
  });
  it('requires grouped updates and rejects duplicate physical slide hot keys', () => {
    const current = song();
    const {groups: _groups, arrangements: _arrangements, ...header} = current;
    expect(
      parseContentEdit({
        type: 'song.update',
        baseRevision: 1,
        song: {
          ...header,
          schemaVersion: 1,
          slides: [{lines: ['Invented legacy line']}],
        },
      }).ok,
    ).toBe(false);
    const keyed = {
      ...current,
      groups: current.groups.map(group => ({
        ...group,
        slides: [{lines: ['Invented keyed line'], hotKey: 'KeyK'}],
      })),
    };
    expect(
      parseContentEdit({type: 'song.update', baseRevision: 1, song: keyed}).ok,
    ).toBe(true);
    expect(
      parseContentEdit({
        type: 'song.update',
        baseRevision: 1,
        song: {
          ...keyed,
          groups: [
            ...keyed.groups,
            {
              id: '00000000-0000-4000-8000-000000000102',
              name: 'Repeated key',
              slides: [{lines: [], hotKey: 'KeyK'}],
            },
          ],
        },
      }).ok,
    ).toBe(false);
  });
  it.each([
    [{type: 'song.create'}],
    [{type: 'song.update', song: song(), baseRevision: 3}],
    [{type: 'song.delete', songId: SONG_ID}],
    [
      {
        type: 'song.arrangement.rename',
        songId: SONG_ID,
        from: '주일용',
        to: '짧게',
      },
    ],
    [{type: 'song.arrangement.delete', songId: SONG_ID, name: '주일용'}],
    [
      {
        type: 'service.create',
        name: '수요 예배',
        date: '2026-11-04T19:30',
        templateId: TEMPLATE_ID,
      },
    ],
    [
      {
        type: 'service.create',
        name: '',
        date: '2026-11-04T19:30',
        templateId: null,
      },
    ],
    [{type: 'service.update', service: service(), baseRevision: 1}],
    [{type: 'service.delete', serviceId: SERVICE_ID}],
    [
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        from: {kind: 'service', id: OTHER_SERVICE_ID},
        itemIds: [ITEM_ID],
      },
    ],
    [
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        from: {kind: 'template', id: TEMPLATE_ID},
        itemIds: [ITEM_ID],
      },
    ],
    [{type: 'service.saveAsTemplate', serviceId: SERVICE_ID, name: '주일'}],
    [{type: 'template.update', template: template(), baseRevision: 2}],
    [{type: 'template.delete', templateId: TEMPLATE_ID}],
  ])('accepts %o', edit => {
    expect(parseContentEdit(edit)).toEqual({ok: true, value: edit});
  });

  it.each([
    ['an unknown type', {type: 'song.copy'}, 'type'],
    [
      'an update without its base revision',
      {type: 'song.update', song: song()},
      'baseRevision',
    ],
    [
      'a base revision of zero',
      {type: 'song.update', song: song(), baseRevision: 0},
      'baseRevision',
    ],
    [
      'a song without a title',
      {type: 'song.update', song: {...song(), title: ''}, baseRevision: 1},
      'song.title',
    ],
    [
      'a rename to the default 구성',
      {
        type: 'song.arrangement.rename',
        songId: SONG_ID,
        from: '주일용',
        to: '기본',
      },
      'to',
    ],
    [
      'a delete of the default 구성',
      {type: 'song.arrangement.delete', songId: SONG_ID, name: '기본'},
      'name',
    ],
    [
      'an import with no items',
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        from: {kind: 'service', id: OTHER_SERVICE_ID},
        itemIds: [],
      },
      'itemIds',
    ],
    [
      'an import from an unknown kind of source',
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        from: {kind: 'song', id: SONG_ID},
        itemIds: [ITEM_ID],
      },
      'from.kind',
    ],
    [
      'an import from a 템플릿 without a UUID',
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        from: {kind: 'template', id: '주일'},
        itemIds: [ITEM_ID],
      },
      'from.id',
    ],
    [
      'an import that names its source the old way',
      {
        type: 'service.importItems',
        serviceId: SERVICE_ID,
        fromServiceId: OTHER_SERVICE_ID,
        itemIds: [ITEM_ID],
      },
      'from',
    ],
    [
      'a service date without the time',
      {
        type: 'service.create',
        name: '',
        date: '2026-11-04',
        templateId: null,
      },
      'date',
    ],
    [
      'a song id that is not a UUID',
      {type: 'song.delete', songId: 'x'},
      'songId',
    ],
  ])('rejects %s', (_name, edit, field) => {
    const parsed = parseContentEdit(edit);

    expect(parsed.ok ? null : parsed.error.field).toBe(field);
  });

  it('rejects values that are not an edit', () => {
    for (const value of [null, [], 'song.create', [{type: 'song.create'}]]) {
      expect(parseContentEdit(value).ok).toBe(false);
    }
  });

  it('drops fields an edit does not declare, and keeps the song unknown fields', () => {
    const edit = {
      type: 'song.update',
      song: {...song(), copyright: 'public domain'},
      baseRevision: 3,
      extra: true,
    };

    expect(parseContentEdit(edit)).toEqual({
      ok: true,
      value: {
        type: 'song.update',
        song: {...song(), copyright: 'public domain'},
        baseRevision: 3,
      },
    });
  });

  it('keeps a song field named __proto__ as a plain field', () => {
    const edit: unknown = JSON.parse(
      JSON.stringify({
        type: 'song.update',
        song: song(),
        baseRevision: 1,
      }).replace('"title"', '"__proto__":{"polluted":true},"title"'),
    );

    const parsed = parseContentEdit(edit);

    expect(parsed.ok).toBe(true);
    expect(Object.prototype).not.toHaveProperty('polluted');
    const songValue: unknown =
      parsed.ok && parsed.value.type === 'song.update'
        ? parsed.value.song
        : null;
    expect(Object.getOwnPropertyNames(songValue)).toContain('__proto__');
  });
});

describe('parseEditResult', () => {
  it('accepts a success and a failure', () => {
    for (const result of [
      {ok: true, value: {id: SONG_ID, revision: 4}},
      {ok: true, value: {id: SONG_ID, revision: null}},
      {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'disk full',
          applied: {id: SONG_ID, revision: 2},
          unchangedFiles: ['D:\\LoveLight\\Services\\a.llservice'],
        },
      },
      {ok: false, error: {reason: 'stale', message: 'revision 3, not 2'}},
    ]) {
      expect(parseEditResult(result)).toEqual({ok: true, value: result});
    }
  });

  it.each([
    ['an unknown reason', {ok: false, error: {reason: 'busy', message: ''}}],
    [
      'a write failure without the applied result',
      {
        ok: false,
        error: {reason: 'write-failed', message: '', unchangedFiles: ['a']},
      },
    ],
    [
      'a write failure without a file',
      {
        ok: false,
        error: {
          reason: 'write-failed',
          message: '',
          applied: {id: SONG_ID, revision: 2},
          unchangedFiles: [],
        },
      },
    ],
    ['a success without an id', {ok: true, value: {id: '', revision: 1}}],
    ['a result that is an array', []],
  ])('rejects %s', (_name, result) => {
    expect(parseEditResult(result).ok).toBe(false);
  });
});
