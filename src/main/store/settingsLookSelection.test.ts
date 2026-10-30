import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import type {DocumentFiles} from './contentPersistence';
import {createLookSelection} from './lookSelection';
import {SettingsStore, type SettingsReader} from './settingsStore';

const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';
const MISSING = '00000000-0000-4000-8000-000000000012';

function setup(access: 'editable' | 'readOnly' = 'editable') {
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'looks',
      revision: 7,
      access,
      value: {
        format: 'llsettings.looks',
        schemaVersion: 1,
        current: FIRST,
        looks: [
          {id: FIRST, name: 'First', screens: {}, future: 'kept'},
          {id: SECOND, name: 'Second', screens: {}},
        ],
        lyricStyles: [],
        future: {retained: true},
      },
    }),
  );
  const log = recordingLogger();
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockResolvedValue({ok: true, value: undefined});
  const store = new SettingsStore({
    documents: new Map([['looks', document]]),
    problems: [],
    log,
    saving: {
      folder: '/settings',
      delayMs: 0,
      files: {write, remove: async () => ({ok: true, value: undefined})},
    },
  });
  const port = createLookSelection(Promise.resolve(store), log);
  onTestFinished(async () => {
    port.dispose();
    await store.dispose();
  });
  return {store, port, write, log};
}

describe('main Look selection port', () => {
  it('updates only the saved current Look using the latest revision and preserves future fields', async () => {
    const {store, port, write} = setup();
    const changes = vi.fn();
    store.subscribe(changes);
    const first = port.selectLook(SECOND);
    const second = port.selectLook(FIRST);
    expect(await first).toEqual({ok: true, value: {id: 'looks', revision: 8}});
    expect(await second).toEqual({ok: true, value: {id: 'looks', revision: 9}});
    expect(store.get('looks')).toMatchObject({
      revision: 9,
      value: {
        current: FIRST,
        future: {retained: true},
        looks: [{future: 'kept'}, {}],
      },
    });
    expect(changes).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].text).toContain('"retained": true');
    const before = store.get('looks');
    expect(await port.selectLook(FIRST)).toEqual({
      ok: true,
      value: {id: 'looks', revision: 9},
    });
    expect(store.get('looks')).toBe(before);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    undefined,
    '',
    'main',
    'a'.repeat(100),
    `${FIRST}\n`,
    'ABCDEFAB-0000-4000-8000-000000000010',
    [FIRST],
    {id: FIRST},
  ])('rejects malformed selection %j before reading settings', async value => {
    const {store, port, write} = setup();
    const get = vi.spyOn(store, 'get');
    expect(await port.selectLook(value)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects a deleted Look without changing the current selection', async () => {
    const {store, port, write} = setup();
    const before = store.get('looks');
    expect(await port.selectLook(MISSING)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(store.get('looks')).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses a reader without a writer instead of reporting a saved selection', async () => {
    const {store, write, log} = setup();
    const reader: SettingsReader = {
      get: name => store.get(name),
      preferences: () => store.preferences(),
      subscribe: listener => store.subscribe(listener),
    };
    const port = createLookSelection(Promise.resolve(reader), log);
    onTestFinished(port.dispose);
    expect(await port.selectLook(SECOND)).toEqual({
      ok: false,
      error: {reason: 'not-found', message: 'Look settings cannot be saved'},
    });
    expect(store.get('looks')).toMatchObject({value: {current: FIRST}});
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['read', 'write'])(
    'classifies and logs a thrown %s failure',
    async operation => {
      const {store, port, log, write} = setup();
      const failure = new Error('Unavailable settings');
      if (operation === 'read') {
        vi.spyOn(store, 'get').mockImplementationOnce(() => {
          throw failure;
        });
      } else vi.spyOn(store, 'apply').mockRejectedValueOnce(failure);
      expect(await port.selectLook(SECOND)).toEqual({
        ok: false,
        error: {reason: 'invalid', message: 'The Look selection failed'},
      });
      expect(log.entries).toContainEqual({
        level: 'error',
        message: 'could not select a Look',
        detail: failure,
      });
      expect(write).not.toHaveBeenCalled();
    },
  );

  it('applies the saved choice immediately but settles only after the debounced write', async () => {
    const {store, port, write} = setup();
    let complete: () => void = () => undefined;
    write.mockReturnValueOnce(
      new Promise(resolve => {
        complete = () => resolve({ok: true, value: undefined});
      }),
    );
    let settled = false;
    const pending = port.selectLook(SECOND).then(result => {
      settled = true;
      return result;
    });
    try {
      await vi.waitFor(() => expect(write).toHaveBeenCalledOnce(), {
        interval: 1,
      });
      expect(store.get('looks')).toMatchObject({value: {current: SECOND}});
      expect(settled).toBe(false);
    } finally {
      complete();
      expect(await pending).toMatchObject({ok: true});
    }
  });

  it('respects read-only files', async () => {
    const {store, port, write} = setup('readOnly');
    const before = store.get('looks');
    expect(await port.selectLook(SECOND)).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
    expect(store.get('looks')).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('does not select after disposal while loading is pending', async () => {
    const {store, log, write} = setup();
    let finish: (store: SettingsReader) => void = () => undefined;
    const port = createLookSelection(
      new Promise<SettingsReader>(resolve => {
        finish = resolve;
      }),
      log,
    );
    const pending = port.selectLook(SECOND);
    port.dispose();
    finish(store);
    expect(await pending).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('reports a failed save without discarding the applied in-memory Look', async () => {
    const {store, port, write} = setup();
    write.mockResolvedValue({
      ok: false,
      error: {file: '/settings/looks.json', message: 'disk full'},
    });
    expect(await port.selectLook(SECOND)).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', applied: {id: 'looks', revision: 8}},
    });
    expect(store.get('looks')).toMatchObject({value: {current: SECOND}});
  });

  it('reports unavailable settings and rejected loading', async () => {
    const log = recordingLogger();
    for (const loading of [
      Promise.resolve(null),
      Promise.reject(new Error('load failed')),
    ]) {
      const port = createLookSelection(loading, log);
      expect(await port.selectLook(SECOND)).toMatchObject({
        ok: false,
        error: {reason: 'not-found'},
      });
      port.dispose();
    }
    expect(log.messages('error')).toContain('could not open Look selection');
  });
});
