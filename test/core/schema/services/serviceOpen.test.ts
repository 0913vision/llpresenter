import {describe, expect, it} from 'vitest';
import {createServiceId} from '@core/schema/common/ids';
import {
  parseServiceOpenRequest,
  parseServiceOpenReply,
} from '@core/schema/services/serviceOpen';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const ID = createServiceId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab');
const OTHER = createServiceId('00000000-0000-4000-8000-000000000002');
const shown = {
  id: ID,
  name: 'Invented service',
  revision: 1,
  readOnly: false,
  rows: [],
  tiles: {},
};

describe('service.open boundary', () => {
  it('accepts a branded service ID, the matching projection, or why it did not open', () => {
    expect(
      expectSuccess(parseServiceOpenRequest({serviceId: ID, future: true})),
    ).toEqual({serviceId: ID});
    expect(
      expectSuccess(parseServiceOpenReply(ID, {ok: true, value: shown})),
    ).toEqual({ok: true, value: shown});
    for (const reason of ['missing', 'busy', 'failed'] as const) {
      expect(
        expectSuccess(parseServiceOpenReply(ID, {ok: false, error: {reason}})),
      ).toEqual({ok: false, error: {reason}});
    }
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
  it('rejects a malformed or mismatched projection and an unknown reason', () => {
    const opened = (value: unknown) => ({ok: true, value});
    expect(parseServiceOpenReply(ID, opened({...shown, id: OTHER})).ok).toBe(
      false,
    );
    expect(parseServiceOpenReply(ID, opened({...shown, rows: 'bad'})).ok).toBe(
      false,
    );
    expect(parseServiceOpenReply(ID, opened(null)).ok).toBe(false);
    expect(parseServiceOpenReply(ID, shown).ok).toBe(false);
    expect(
      parseServiceOpenReply(ID, {ok: false, error: {reason: 'gone'}}).ok,
    ).toBe(false);
  });
});
