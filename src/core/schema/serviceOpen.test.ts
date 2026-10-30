import {describe, expect, it} from 'vitest';
import {createServiceId} from './ids';
import {parseServiceOpenRequest, parseServiceOpenReply} from './serviceOpen';
import {expectSuccess} from './testHelpers';

const ID = createServiceId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab');
const OTHER = createServiceId('00000000-0000-4000-8000-000000000002');
const shown = {
  id: ID,
  name: 'Invented service',
  revision: 1,
  readOnly: false,
  rows: [],
  tiles: {},
  jumpKeys: {},
};

describe('service.open boundary', () => {
  it('accepts a branded service ID and the matching projection or null', () => {
    expect(
      expectSuccess(parseServiceOpenRequest({serviceId: ID, future: true})),
    ).toEqual({serviceId: ID});
    expect(expectSuccess(parseServiceOpenReply(ID, shown))).toEqual(shown);
    expect(expectSuccess(parseServiceOpenReply(ID, null))).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    {serviceId: 'bad'},
    {serviceId: ID.toUpperCase()},
    {serviceId: 4},
  ])('rejects an invalid request %#', value => {
    expect(parseServiceOpenRequest(value).ok).toBe(false);
  });
  it('rejects a malformed or mismatched projection', () => {
    expect(parseServiceOpenReply(ID, {...shown, id: OTHER}).ok).toBe(false);
    expect(parseServiceOpenReply(ID, {...shown, rows: 'bad'}).ok).toBe(false);
  });
});
