import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  parseAppFlushDone,
  parseAppFlushRequest,
  parseAppSavePendingResult,
  type AppFlushDone,
  type AppFlushRequest,
} from './appFlush';
import {
  createAppFlushRequestId,
  type AppFlushRequestId,
  type SongId,
} from './ids';

const ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const OTHER_ID = 'b52f1d63-8f2a-4b3c-9d4e-5f6071829304';

describe('app flush handshake payloads', () => {
  it.each([true, false])('reads the disk save result %s', value => {
    expect(parseAppSavePendingResult(value)).toEqual({ok: true, value});
  });

  it.each([undefined, null, 0, 1, 'true', {}, []])(
    'rejects an invalid disk save result %j',
    value => {
      expect(parseAppSavePendingResult(value).ok).toBe(false);
    },
  );
  it('reads the request and strips fields outside the bounded contract', () => {
    expect(parseAppFlushRequest({requestId: ID, extra: ['ignored']})).toEqual({
      ok: true,
      value: {requestId: ID},
    });
  });

  it.each([true, false])('reads result %s for the matching request', result => {
    expect(
      parseAppFlushDone(
        {requestId: ID, result, extra: true},
        createAppFlushRequestId(ID),
      ),
    ).toEqual({
      ok: true,
      value: {requestId: ID, result},
    });
  });

  it.each([
    {name: 'null', value: null, field: ''},
    {name: 'an array', value: [{requestId: ID}], field: ''},
    {name: 'a class instance', value: new Date(), field: ''},
    {name: 'a missing ID', value: {}, field: 'requestId'},
    {name: 'a number', value: {requestId: 1}, field: 'requestId'},
    {name: 'a non-UUID', value: {requestId: 'request-1'}, field: 'requestId'},
    {
      name: 'an uppercase UUID',
      value: {requestId: ID.toUpperCase()},
      field: 'requestId',
    },
    {
      name: 'an oversized ID',
      value: {requestId: 'a'.repeat(4096)},
      field: 'requestId',
    },
  ])('rejects a request with $name', ({value, field}) => {
    expect(parseAppFlushRequest(value)).toMatchObject({
      ok: false,
      error: {field},
    });
  });

  it.each([
    {name: 'null', value: null, field: ''},
    {name: 'an array', value: [], field: ''},
    {name: 'a missing ID', value: {result: true}, field: 'requestId'},
    {
      name: 'an invalid ID',
      value: {requestId: 'request-1', result: true},
      field: 'requestId',
    },
    {name: 'a missing result', value: {requestId: ID}, field: 'result'},
    {
      name: 'a numeric result',
      value: {requestId: ID, result: 1},
      field: 'result',
    },
    {
      name: 'a string result',
      value: {requestId: ID, result: 'true'},
      field: 'result',
    },
    {
      name: 'an object result',
      value: {requestId: ID, result: {ok: true}},
      field: 'result',
    },
  ])('rejects a reply with $name', ({value, field}) => {
    expect(parseAppFlushDone(value)).toMatchObject({ok: false, error: {field}});
  });

  it('rejects a valid reply that belongs to another request ID', () => {
    const reply = {requestId: OTHER_ID, result: true};
    expect(parseAppFlushDone(reply).ok).toBe(true);
    expect(parseAppFlushDone(reply, createAppFlushRequestId(ID))).toMatchObject(
      {
        ok: false,
        error: {field: 'requestId'},
      },
    );
  });

  it('brands generated IDs through the public schema helper', () => {
    expect(createAppFlushRequestId(ID)).toBe(ID);
    expect(() => createAppFlushRequestId('invalid')).toThrow();
    expectTypeOf<
      AppFlushRequest['requestId']
    >().toEqualTypeOf<AppFlushRequestId>();
    expectTypeOf<
      AppFlushDone['requestId']
    >().toEqualTypeOf<AppFlushRequestId>();
    expectTypeOf<AppFlushRequestId>().not.toEqualTypeOf<SongId>();
    expectTypeOf<AppFlushDone['result']>().toEqualTypeOf<boolean>();
  });
});
