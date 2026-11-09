import {describe, expect, it} from 'vitest';
import {
  parseUpdateAction,
  parseUpdateSnapshot,
  parseUpdateVersion,
} from '@core/schema/update';

const snapshot = {revision: 1, visible: true, outputsOn: false, busy: false};

describe('update payloads', () => {
  it.each([
    {kind: 'idle'},
    {kind: 'unsupported'},
    {kind: 'checking'},
    {kind: 'available', version: '1.2.3'},
    {kind: 'downloading', version: '1.2.3', percent: 50},
    {kind: 'downloaded', version: '1.2.3'},
    {kind: 'installing', version: '1.2.3'},
    {kind: 'latest', version: '1.2.3'},
    {kind: 'error', reason: 'Offline'},
  ])('accepts a bounded %j result', status => {
    expect(parseUpdateSnapshot({...snapshot, status}).ok).toBe(true);
  });
  it.each([
    null,
    [],
    {...snapshot, status: {kind: 'unknown'}},
    {...snapshot, revision: -1, status: {kind: 'idle'}},
    {...snapshot, visible: 'yes', status: {kind: 'idle'}},
    {...snapshot, status: {kind: 'downloaded', version: 'x'.repeat(65)}},
    {...snapshot, status: {kind: 'error', reason: 'x'.repeat(241)}},
    ...[-1, 101, NaN, Infinity, 1.5].map(percent => ({
      ...snapshot,
      status: {kind: 'downloading', version: '1.2.3', percent},
    })),
  ])('rejects malformed or oversized %j', value => {
    expect(parseUpdateSnapshot(value).ok).toBe(false);
  });
  it.each(['download', 'install', 'later', 'dismiss'])(
    'accepts the %s action',
    action => {
      expect(parseUpdateAction({action, revision: 1, ignored: true})).toEqual({
        ok: true,
        value: {action, revision: 1},
      });
    },
  );
  it.each([
    null,
    [],
    {action: 'quit', revision: 1},
    {action: 'install'},
    {action: 'install', revision: 1.2},
  ])('rejects invalid actions %j', value => {
    expect(parseUpdateAction(value).ok).toBe(false);
  });
  it('rejects version strings containing paths or markup', () => {
    expect(parseUpdateVersion('../1.2.3').ok).toBe(false);
    expect(parseUpdateVersion('<b>1.2.3</b>').ok).toBe(false);
  });
});
