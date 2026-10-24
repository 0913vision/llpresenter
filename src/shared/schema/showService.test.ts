import {describe, expect, it} from 'vitest';
import {parseShowService} from './showService';

function showService() {
  return {
    revision: 2,
    id: 'service-1',
    name: '주일 예배',
    readOnly: false,
    rows: [
      {kind: 'header', id: 'item-1', title: '찬양'},
      {kind: 'song', id: 'item-2', title: '만복의 근원 하나님'},
      {kind: 'song', id: 'item-3', title: '', problem: 'missing-song'},
      {kind: 'unknown', id: 'item-4', title: '', problem: 'unknown-kind'},
      {kind: 'song', id: 'item-5', title: '새 버전', problem: 'newer-version'},
    ],
    tiles: {
      'item-2': [
        {label: '1절', labelColor: 'teal', lines: ['만복의 근원 하나님']},
        {label: null, labelColor: 'none', lines: []},
      ],
    },
    jumpKeys: {KeyC: '후렴'},
  };
}

describe('parseShowService', () => {
  it('accepts a service and no service', () => {
    expect(parseShowService(showService())).toEqual({
      ok: true,
      value: showService(),
    });
    expect(parseShowService(null)).toEqual({ok: true, value: null});
  });

  it.each([
    [
      'an unknown row kind',
      {rows: [{kind: 'video', id: 'x', title: ''}]},
      'rows.0.kind',
    ],
    [
      'a header with a problem field that is dropped',
      {rows: [{kind: 'header', id: 'x', title: 't', problem: 'missing-song'}]},
      null,
    ],
    [
      'an unknown problem',
      {rows: [{kind: 'song', id: 'x', title: '', problem: 'broken'}]},
      'rows.0.problem',
    ],
    [
      'a row without an id',
      {rows: [{kind: 'song', id: '', title: ''}]},
      'rows.0.id',
    ],
    [
      'a tile color outside the palette',
      {tiles: {a: [{label: null, labelColor: 'red', lines: []}]}},
      'tiles.a.0.labelColor',
    ],
    ['tiles that are an array', {tiles: []}, 'tiles'],
    ['a negative revision', {revision: -1}, 'revision'],
    ['a read-only flag that is text', {readOnly: 'yes'}, 'readOnly'],
  ])('checks %s', (_name, change, field) => {
    const result = parseShowService({...showService(), ...change});

    expect(result.ok ? null : result.error.field).toBe(field);
  });

  it('rejects values that are not a service', () => {
    for (const value of [undefined, [], 'service', 3]) {
      expect(parseShowService(value).ok).toBe(false);
    }
  });
});
